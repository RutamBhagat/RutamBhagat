use anchor_lang::prelude::*;
mod contexts;
use contexts::*;
mod state;
use state::*;

declare_id!("8XcApMHke2GjVzJQAB7ZCvHF8SpikYsndQNB8jwWDb4C");

#[program]
pub mod escrow {
    use super::*;

    pub fn make(ctx: Context<Make>, seed: u64, amount: u64, receive: u64) -> Result<()> {
        ctx.accounts.save_escrow(seed, receive, ctx.bumps.escrow)?;
        ctx.accounts.deposit_to_vault(amount)
    }

    pub fn take(ctx: Context<Take>) -> Result<()> {
        // ctx.accounts.transfer(amount)?;
        // ctx.accounts.withdraw_and_close()
        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        ctx.accounts.withdraw_and_close()
    }
}
