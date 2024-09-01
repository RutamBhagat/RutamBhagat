import * as anchor from "@coral-xyz/anchor";

import { Program } from "@coral-xyz/anchor";
import { VoteProgram } from "../target/types/vote_program";
import { expect } from "chai";

describe("vote-program", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VoteProgram as Program<VoteProgram>;

  const url = "https://wba.dev";

  const [voteAccount] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(url)],
    program.programId
  );

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods
      .initialize(url)
      .accounts({
        payer: provider.wallet.publicKey,
      })
      .rpc();

    console.log("Your transaction signature", tx);

    let voteState = await program.account.voteState.fetch(voteAccount);
    console.log("Your vote score is", voteState.score.toString());
  });

  it("Upvote!", async () => {
    const tx = await program.methods.upvote(url).rpc();

    console.log("Your transaction signature", tx);

    let voteState = await program.account.voteState.fetch(voteAccount);
    console.log("Your vote score is", voteState.score.toString());
  });

  it("Downvote!", async () => {
    const tx = await program.methods.downvote(url).rpc();

    console.log("Your transaction signature", tx);

    let voteState = await program.account.voteState.fetch(voteAccount);
    console.log("Your vote score is", voteState.score.toString());
  });

  it("Get last voter!", async () => {
    // First, let's upvote to ensure we have a last voter
    await program.methods
      .upvote(url)
      .accounts({
        voter: provider.wallet.publicKey,
      })
      .rpc();

    // Now, let's get the last voter
    const lastVoter = await program.methods.getLastVoter(url).view();

    console.log("Last voter:", lastVoter.toString());

    // Check if the last voter matches our wallet's public key
    expect(lastVoter.toString() === provider.wallet.publicKey.toString());

    // Fetch the vote state to double-check
    let voteState = await program.account.voteState.fetch(voteAccount);
    console.log("Last voter from state:", voteState.lastVoter.toString());

    // Additional check to ensure the state matches the returned value
    expect(voteState.lastVoter.toString() === lastVoter.toString());
  });
});
