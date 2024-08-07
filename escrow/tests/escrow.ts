import * as anchor from "@coral-xyz/anchor";
import * as dotenv from "dotenv";
import * as path from "path";

import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  getAccount,
  mintTo,
} from "@solana/spl-token";

import { Escrow } from "../target/types/escrow";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

describe("Escrow", () => {
  // Create a keypair from the private key in .env
  const privateKeyArray = JSON.parse(process.env.PRIVATE_KEY || "[]");
  const payerKeypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));

  const provider = new anchor.AnchorProvider(
    anchor.getProvider().connection,
    new anchor.Wallet(payerKeypair),
    {}
  );
  anchor.setProvider(provider);

  const program = anchor.workspace.Escrow as Program<Escrow>;

  const maker = provider.wallet.publicKey;
  const taker = Keypair.generate();

  let mintA: PublicKey;
  let mintB: PublicKey;
  let makerAtaA: PublicKey;
  let makerAtaB: PublicKey;
  let takerAtaA: PublicKey;
  let takerAtaB: PublicKey;
  let vault: PublicKey;
  let escrow: PublicKey;
  let seed: anchor.BN;

  const amountA = new anchor.BN(100_000_000); // 100 tokens
  const amountB = new anchor.BN(200_000_000); // 200 tokens

  before(async () => {
    // Airdrop SOL to taker
    await provider.connection.requestAirdrop(taker.publicKey, LAMPORTS_PER_SOL);

    // Create mints
    mintA = await createMint(provider.connection, payerKeypair, maker, null, 6);
    mintB = await createMint(
      provider.connection,
      payerKeypair,
      taker.publicKey,
      null,
      6
    );

    // Create ATAs
    makerAtaA = await createAccount(
      provider.connection,
      payerKeypair,
      mintA,
      maker
    );
    makerAtaB = await createAccount(
      provider.connection,
      payerKeypair,
      mintB,
      maker
    );
    takerAtaA = await createAccount(
      provider.connection,
      taker,
      mintA,
      taker.publicKey
    );
    takerAtaB = await createAccount(
      provider.connection,
      taker,
      mintB,
      taker.publicKey
    );

    // Mint tokens
    await mintTo(
      provider.connection,
      payerKeypair,
      mintA,
      makerAtaA,
      maker,
      BigInt(amountA.toString())
    );
    await mintTo(
      provider.connection,
      taker,
      mintB,
      takerAtaB,
      taker.publicKey,
      BigInt(amountB.toString())
    );

    // Generate seed
    seed = new anchor.BN(Math.floor(Math.random() * 1000000));

    // Derive PDA for escrow
    [escrow] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        maker.toBuffer(),
        seed.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Derive vault address
    [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), escrow.toBuffer()],
      TOKEN_PROGRAM_ID
    );
  });
  it("Initialize escrow", async () => {
    await program.methods
      .make(seed, amountA, amountB)
      .accountsPartial({
        maker: maker,
        mintA: mintA,
        mintB: mintB,
        makerAtaA: makerAtaA,
        escrow: escrow,
        vault: vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const escrowAccount = await program.account.escrow.fetch(escrow);
    assert.ok(escrowAccount.maker.equals(maker));
    assert.ok(escrowAccount.mintA.equals(mintA));
    assert.ok(escrowAccount.mintB.equals(mintB));
    assert.ok(escrowAccount.receive.eq(amountB));

    const vaultAccount = await getAccount(provider.connection, vault);
    assert.strictEqual(vaultAccount.amount, BigInt(amountA.toString()));
  });

  it("Take the trade", async () => {
    await program.methods
      .take()
      .accountsPartial({
        taker: taker.publicKey,
        maker: maker,
        mintA: mintA,
        mintB: mintB,
        takerAtaA: takerAtaA,
        takerAtaB: takerAtaB,
        makerAtaB: makerAtaB,
        escrow: escrow,
        vault: vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([taker])
      .rpc();

    const makerAtaBAccount = await getAccount(provider.connection, makerAtaB);
    assert.strictEqual(makerAtaBAccount.amount, BigInt(amountB.toString()));

    const takerAtaAAccount = await getAccount(provider.connection, takerAtaA);
    assert.strictEqual(takerAtaAAccount.amount, BigInt(amountA.toString()));

    // Verify escrow account is closed
    try {
      await program.account.escrow.fetch(escrow);
      assert.fail("Expected an error but did not receive one");
    } catch (error) {
      assert(error instanceof Error, "error is not an Error object");
      assert(
        error.message.includes("Account does not exist or has no data"),
        `Unexpected error message: ${error.message}`
      );
    }
  });

  it("Refund the escrow", async () => {
    // First, we need to create a new escrow
    const newSeed = new anchor.BN(Math.floor(Math.random() * 1000000));
    const [newEscrow] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        maker.toBuffer(),
        newSeed.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [newVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), newEscrow.toBuffer()],
      TOKEN_PROGRAM_ID
    );

    await program.methods
      .make(newSeed, amountA, amountB)
      .accountsPartial({
        maker: maker,
        mintA: mintA,
        mintB: mintB,
        makerAtaA: makerAtaA,
        escrow: newEscrow,
        vault: newVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Now, let's refund the escrow
    await program.methods
      .refund()
      .accountsPartial({
        maker: maker,
        mintA: mintA,
        makerAtaA: makerAtaA,
        escrow: newEscrow,
        vault: newVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const makerAtaAAccount = await getAccount(provider.connection, makerAtaA);
    assert.strictEqual(makerAtaAAccount.amount, BigInt(amountA.toString()));

    // Verify escrow account is closed
    try {
      await program.account.escrow.fetch(newEscrow);
      assert.fail("Expected an error but did not receive one");
    } catch (error) {
      assert(error instanceof Error, "error is not an Error object");
      assert(
        error.message.includes("Account does not exist or has no data"),
        `Unexpected error message: ${error.message}`
      );
    }
  });
});
