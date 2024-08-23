import * as anchor from "@coral-xyz/anchor";

import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import { Keypair } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import { expect } from "chai";

describe("vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vault as Program<Vault>;
  const user = provider.wallet;
  let vaultStatePda: PublicKey;
  let vaultPda: PublicKey;

  before(async () => {
    [vaultStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state"), user.publicKey.toBuffer()],
      program.programId
    );
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), vaultStatePda.toBuffer()],
      program.programId
    );
  });

  it("Initializes the vault with no lock", async () => {
    const tx = await program.methods
      .initialize(null)
      .accounts({
        user: user.publicKey,
      })
      .rpc();

    console.log("Initialization transaction signature", tx);

    const vaultState = await program.account.vaultState.fetch(vaultStatePda);
    expect(vaultState.vaultBump).to.not.be.null;
    expect(vaultState.stateBump).to.not.be.null;
    expect(vaultState.unlockTime.toNumber()).to.equal(0);
  });

  it("Initializes the vault with a lock duration", async () => {
    const newUser = Keypair.generate();
    await provider.connection.requestAirdrop(
      newUser.publicKey,
      LAMPORTS_PER_SOL
    );
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for airdrop to be confirmed

    const lockDuration = new anchor.BN(60); // 60 seconds

    const [newVaultStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state"), newUser.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .initialize(lockDuration)
      .accounts({
        user: newUser.publicKey,
      })
      .signers([newUser])
      .rpc();

    console.log("Initialization with lock transaction signature", tx);

    const vaultState = await program.account.vaultState.fetch(newVaultStatePda);
    expect(vaultState.unlockTime.toNumber()).to.be.above(0);
  });

  it("Deposits funds into the vault", async () => {
    const depositAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
    const initialUserBalance = await provider.connection.getBalance(
      user.publicKey
    );
    const initialVaultBalance = await provider.connection.getBalance(vaultPda);

    const tx = await program.methods
      .deposit(depositAmount)
      .accounts({
        user: user.publicKey,
      })
      .rpc();

    console.log("Deposit transaction signature", tx);

    const finalUserBalance = await provider.connection.getBalance(
      user.publicKey
    );
    const finalVaultBalance = await provider.connection.getBalance(vaultPda);

    // this one is a bit tricky because of rounding errors
    expect(finalUserBalance).to.be.below(
      initialUserBalance - depositAmount.toNumber()
    );
    expect(
      finalVaultBalance === initialVaultBalance + depositAmount.toNumber()
    );
  });

  it("Respects time-lock for withdrawals", async () => {
    const userKeypair = Keypair.generate();
    const lockDuration = new anchor.BN(2); // 2 seconds for faster testing
    const depositAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

    // Airdrop some SOL to the new user
    await provider.connection.requestAirdrop(
      userKeypair.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const [newVaultStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state"), userKeypair.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initialize(lockDuration)
      .accounts({
        user: userKeypair.publicKey,
      })
      .signers([userKeypair])
      .rpc();

    // Deposit funds
    await program.methods
      .deposit(depositAmount)
      .accounts({
        user: userKeypair.publicKey,
      })
      .signers([userKeypair])
      .rpc();

    // Try to withdraw immediately (should fail)
    try {
      await program.methods
        .withdraw(depositAmount)
        .accounts({
          user: userKeypair.publicKey,
        })
        .signers([userKeypair])
        .rpc();
      expect.fail("Withdrawal should have failed due to time-lock");
    } catch (error) {
      console.log("Error message:", error.message);
      expect(error.message).to.include("VaultLocked"); // Adjust this based on the actual error message
    }

    // Wait for the lock duration to pass
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Try to withdraw after lock duration (should succeed)
    const initialUserBalance = await provider.connection.getBalance(
      userKeypair.publicKey
    );

    await program.methods
      .withdraw(depositAmount)
      .accounts({
        user: userKeypair.publicKey,
      })
      .signers([userKeypair])
      .rpc();

    const finalUserBalance = await provider.connection.getBalance(
      userKeypair.publicKey
    );

    // Check if the withdrawal was successful
    expect(finalUserBalance).to.be.above(initialUserBalance);
    expect(finalUserBalance - initialUserBalance).to.be.closeTo(
      depositAmount.toNumber(),
      0.01 * LAMPORTS_PER_SOL
    );
  });

  it("Closes the vault account", async () => {
    const initialUserBalance = await provider.connection.getBalance(
      user.publicKey
    );
    const initialVaultBalance = await provider.connection.getBalance(vaultPda);

    const tx = await program.methods
      .closeAccount()
      .accounts({
        user: user.publicKey,
      })
      .rpc();

    console.log("Close account transaction signature", tx);

    const finalUserBalance = await provider.connection.getBalance(
      user.publicKey
    );
    const finalVaultBalance = await provider.connection.getBalance(vaultPda);

    expect(finalUserBalance).to.be.above(
      initialUserBalance + initialVaultBalance - 10000
    ); // Allow for fees
    expect(finalVaultBalance).to.equal(0);

    // Verify that the vault state account is closed
    try {
      await program.account.vaultState.fetch(vaultStatePda);
      throw new Error("Vault state account should be closed");
    } catch (error) {
      expect(error.message).to.include("Account does not exist");
    }
  });
});
