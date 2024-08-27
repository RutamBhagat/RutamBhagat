pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use instructions::*;
pub use state::*;

declare_id!("DmvouBa2zZWvpbhRSykn6Fa21jRMrU3TGBCbdHDeqFHX");

#[program]
pub mod nft_staking {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        points_per_stake: u8,
        max_stake: u8,
        freeze_period: u32,
    ) -> Result<()> {
        ctx.accounts
            .init_config(points_per_stake, max_stake, freeze_period, &ctx.bumps)
    }

    pub fn initialize_user_account(ctx: Context<InitUserAccount>) -> Result<()> {
        ctx.accounts.init_user_account(&ctx.bumps)
    }

    pub fn stake(ctx: Context<Stake>) -> Result<()> {
        ctx.accounts.stake(&ctx.bumps)
    }

    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        ctx.accounts.unstake()
    }
}
