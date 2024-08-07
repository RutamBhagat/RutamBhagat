use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Take<'info> {
    maker: Signer<'info>,
}
