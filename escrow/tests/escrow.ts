import * as anchor from "@coral-xyz/anchor";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Account,
  TOKEN_2022_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

import { Escrow } from "../target/types/escrow";

describe("Escrow Tests", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const connection = provider.connection;

  const program = anchor.workspace.Escrow as Program<Escrow>;

  const maker = Keypair.generate();
  const taker = Keypair.generate();
  let mintA: PublicKey;
  let mintB: PublicKey;
  let makerAtaA: Account;
  let takerAtaB: Account;
  const associatedTokenProgram = ASSOCIATED_TOKEN_PROGRAM_ID;
  const tokenProgram = TOKEN_2022_PROGRAM_ID;
  const systemProgram = anchor.web3.SystemProgram.programId;

  before(async () => {
    // Airdrop SOL to maker
    const airdropSignature = await provider.connection.requestAirdrop(
      maker.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    // Use the newer version of confirmTransaction
    const latestBlockHash = await provider.connection.getLatestBlockhash();

    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSignature,
    });
    const balance = await provider.connection.getBalance(maker.publicKey);
    console.log(`Maker balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    if (balance === 0) {
      throw new Error("Airdrop failed: Maker account has zero balance");
    }
    // Create mintA
    mintA = await createMint(
      connection,
      maker,
      maker.publicKey,
      null,
      9 // decimals
    );

    // Create mintB
    mintB = await createMint(
      connection,
      maker,
      maker.publicKey,
      null,
      9 // decimals
    );

    // Create makerAtaA
    makerAtaA = await getOrCreateAssociatedTokenAccount(
      connection,
      maker,
      mintA,
      maker.publicKey
    );

    // Create taker_ata_b
    takerAtaB = await getOrCreateAssociatedTokenAccount(
      connection,
      maker, // We're using maker to pay for the creation, but the account will belong to taker
      mintB,
      taker.publicKey
    );

    // Mint tokens to maker from mintA
    await mintTo(
      connection,
      maker,
      mintA,
      makerAtaA.address,
      maker,
      10000000000 // amount, 10 token because decimals are 9
    );

    // Mint tokens to taker from mintB
    await mintTo(
      connection,
      maker,
      mintB,
      takerAtaB.address,
      maker,
      10000000000 // amount, 10 token because decimals are 9
    );
  });

  it("Is initialized!", async () => {
    // Add your test here.
    const seed = new BN(Math.floor(Math.random() * 100));
    const amount = new BN(5);
    const receive = new BN(5);
    const tx = await program.methods
      .make(seed, amount, receive)
      .accountsPartial({
        maker: maker.publicKey,
        mintA,
        mintB,
        makerAtaA: makerAtaA.address,
        associatedTokenProgram,
        tokenProgram,
        systemProgram,
      })
      .signers([maker])
      .rpc();
    console.log("Your transaction signature", tx);
  });
});
