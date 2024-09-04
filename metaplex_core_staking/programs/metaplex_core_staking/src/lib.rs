pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("bQh8rUF7uq2N2KgtYhGa6Pd9Wdg2FYQBLYodqDPZ6WV");

#[program]
pub mod metaplex_core_staking {
    use super::*;

    pub fn stake(ctx: Context<Stake>) -> Result<()> {
        instructions::stake::stake_handler(ctx)
    }

    pub fn unstake(ctx: Context<Stake>) -> Result<()> {
        instructions::stake::unstake_handler(ctx)
    }
}
