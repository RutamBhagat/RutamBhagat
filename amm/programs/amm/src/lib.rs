use anchor_lang::prelude::*;

declare_id!("6QNVRzKYzSwDgMfexBuHHoE1Fc2RSNUsxBuikwX3Q1g");

#[program]
pub mod amm {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
