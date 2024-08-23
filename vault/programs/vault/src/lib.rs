use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

declare_id!("B2g23pCRUqdMaWED1Geb8SkcjgSyNoreFCGaGgVqJMrn");

#[program]
pub mod vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, lock_duration: Option<i64>) -> Result<()> {
        ctx.accounts
            .initialize(&ctx.bumps, lock_duration.unwrap_or(0))
    }

    pub fn deposit(ctx: Context<Payment>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)
    }

    pub fn withdraw(ctx: Context<Payment>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)
    }

    pub fn close_account(ctx: Context<CloseAccount>) -> Result<()> {
        ctx.accounts.close()
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = VaultState::INIT_SPACE,
        seeds = [b"state", user.key().as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        seeds = [b"vault", vault_state.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(&mut self, bumps: &InitializeBumps, lock_duration: i64) -> Result<()> {
        self.vault_state.vault_bump = bumps.vault;
        self.vault_state.state_bump = bumps.vault_state;
        self.vault_state.unlock_time = if lock_duration > 0 {
            Clock::get()?.unix_timestamp + lock_duration
        } else {
            0 // No lock
        };
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Payment<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"state", user.key().as_ref()],
        bump = vault_state.state_bump
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        mut,
        seeds = [b"vault", vault_state.key().as_ref()],
        bump = vault_state.vault_bump
    )]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Payment<'info> {
    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.user.to_account_info(),
            to: self.vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx, amount)
    }

    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;
        if current_time < self.vault_state.unlock_time {
            return Err(VaultError::VaultLocked.into());
        }

        let vault_balance = self.vault.lamports();
        if vault_balance < amount {
            return Err(ProgramError::InsufficientFunds.into());
        }

        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.user.to_account_info(),
        };
        let vault_state_key = self.vault_state.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"vault",
            vault_state_key.as_ref(),
            &[self.vault_state.vault_bump],
        ]];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        transfer(cpi_ctx, amount)
    }
}

#[derive(Accounts)]
pub struct CloseAccount<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        close = user,
        seeds = [b"state", user.key().as_ref()],
        bump = vault_state.state_bump,
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        mut,
        seeds = [b"vault", vault_state.key().as_ref()],
        bump = vault_state.vault_bump
    )]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> CloseAccount<'info> {
    pub fn close(&mut self) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;
        if current_time < self.vault_state.unlock_time {
            return Err(VaultError::VaultLocked.into());
        }

        let vault_balance = self.vault.lamports();
        if vault_balance <= 0 {
            return Err(ProgramError::InsufficientFunds.into());
        }

        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.user.to_account_info(),
        };
        let vault_state_key = self.vault_state.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"vault",
            vault_state_key.as_ref(),
            &[self.vault_state.vault_bump],
        ]];

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        transfer(cpi_ctx, vault_balance)
    }
}

#[account]
pub struct VaultState {
    pub vault_bump: u8,
    pub state_bump: u8,
    pub unlock_time: i64,
}

impl Space for VaultState {
    const INIT_SPACE: usize = 8 + 1 + 1 + 8;
}

#[error_code]
pub enum VaultError {
    #[msg("The vault is locked")]
    VaultLocked,
}
