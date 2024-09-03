use anchor_lang::prelude::*;
use mpl_core::{
    ID as MPL_CORE_ID,
    accounts::{BaseAssetV1, BaseCollectionV1}
};

#[derive(Accounts)]
pub struct Stake<'info> {
    pub owner: Signer<'info>,
    pub update_authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut, 
        has_one = owner
    )]
    pub asset: Account<'info, BaseAssetV1>,
    #[account(
        mut, 
        has_one = update_authority
    )]
    pub collection: Account<'info, BaseCollectionV1>,
    #[account(
        address = MPL_CORE_ID 
    )]
    /// CHECK: this is safe because we have the address constraint
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>
}

pub fn handler(_ctx: Context<Stake>) -> Result<()> {
    // msg!("Greetings from: {{:?}}", ctx.program_id);
    Ok(())
}
