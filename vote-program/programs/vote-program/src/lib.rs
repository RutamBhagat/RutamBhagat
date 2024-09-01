use anchor_lang::prelude::*;

declare_id!("EfUzENuCxeM1V3dxXpTaRFbtNMAboznTKR67CeMWcZ9T");

#[program]
pub mod vote_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, _url: String) -> Result<()> {
        let vote_account = &mut ctx.accounts.vote_account;
        vote_account.score = 0;
        vote_account.bump = ctx.bumps.vote_account;
        vote_account.last_voter = None;
        Ok(())
    }
    pub fn upvote(ctx: Context<Vote>, _url: String) -> Result<()> {
        let vote_account = &mut ctx.accounts.vote_account;
        vote_account.score += 1;
        vote_account.last_voter = Some(ctx.accounts.voter.key());
        Ok(())
    }

    pub fn downvote(ctx: Context<Vote>, _url: String) -> Result<()> {
        let vote_account = &mut ctx.accounts.vote_account;
        vote_account.score -= 1;
        vote_account.last_voter = Some(ctx.accounts.voter.key());
        Ok(())
    }

    pub fn get_last_voter(ctx: Context<GetLastVoter>, _url: String) -> Result<Option<Pubkey>> {
        Ok(ctx.accounts.vote_account.last_voter)
    }
}

#[derive(Accounts)]
#[instruction(_url: String)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        seeds = [_url.as_bytes()],
        bump,
        space = VoteState::INIT_SPACE
    )]
    pub vote_account: Account<'info, VoteState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_url: String)]
pub struct Vote<'info> {
    #[account(
        mut,
        seeds = [_url.as_bytes()],
        bump = vote_account.bump
    )]
    pub vote_account: Account<'info, VoteState>,
    pub voter: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(_url: String)]
pub struct GetLastVoter<'info> {
    #[account(
        seeds = [_url.as_bytes()],
        bump = vote_account.bump
    )]
    pub vote_account: Account<'info, VoteState>,
}

#[account]
pub struct VoteState {
    pub score: i64,
    pub bump: u8,
    pub last_voter: Option<Pubkey>,
}

impl Space for VoteState {
    const INIT_SPACE: usize = 8 + 8 + 1 + 1 + 32; // Add 1 byte for Option discriminant
}
