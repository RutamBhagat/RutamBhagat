use anchor_lang::prelude::*;
mod instructions;

declare_id!("DmvouBa2zZWvpbhRSykn6Fa21jRMrU3TGBCbdHDeqFHX");

#[program]
pub mod nft_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
