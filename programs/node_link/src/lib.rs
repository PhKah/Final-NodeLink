use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("BzBmVWwhcqohg6vHZ7bNrT6nDDvNcsvbkvc6jHwSLgUK");

const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;

#[error_code]
pub enum MyError {
    #[msg("Job is not in a pending state.")]
    JobNotPending,
    #[msg("Provider has previously failed this job.")]
    ProviderPreviouslyFailed,
    #[msg("Job is not in progress.")]
    JobNotInProgress,
    #[msg("Signer is not the assigned provider for this job.")]
    WrongProvider,
}

#[program]
pub mod node_link {
    use super::*;

    pub fn provider_register(ctx: Context<ProviderAccount>) -> Result<()> {
        let provider_account = &mut ctx.accounts.provider;
        provider_account.authority = ctx.accounts.authority.key();
        provider_account.status = ProviderStatus::Available;
        msg!("Provider registered for authority: {}", ctx.accounts.authority.key());
        Ok(())
    }

    pub fn create_job(ctx: Context<CreateJob>, reward: u64, job_details: [u8; 32]) -> Result<()> {
        let job_account = &mut ctx.accounts.job_account;
        job_account.renter = ctx.accounts.renter.key();
        job_account.provider = Pubkey::default();
        job_account.reward = reward;
        job_account.status = JobStatus::Pending;
        job_account.job_details = job_details;
        job_account.results = [0u8; 32];
        job_account.failed_providers = Vec::new();
        job_account.verification_deadline = 0;

        let cpi_context = CpiContext::new (
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.renter.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        );
        transfer(cpi_context,reward)?;
        msg!("Created job's key: {}", ctx.accounts.job_account.key());
        Ok(())
    }
    pub fn accept_job(ctx: Context<AcceptJob>) -> Result<()> {
        let job_account = &mut ctx.accounts.job_account;
        let provider_account = &mut ctx.accounts.provider_account;
        
        if job_account.status != JobStatus::Pending{
            return Err(MyError::JobNotPending.into());
        }
        if job_account.failed_providers.contains(&ctx.accounts.provider.key()){
            return Err(MyError::ProviderPreviouslyFailed.into());
        }
        job_account.provider = ctx.accounts.provider.key();
        job_account.status = JobStatus::InProgress;
        provider_account.status = ProviderStatus::Busy;
        msg!("Provider {} accepted job {}", ctx.accounts.provider.key(), job_account.key());
        Ok(())
    }

    pub fn submit_results(ctx: Context<SubmitResults>, results: [u8; 32]) -> Result <()> {
        let job_account = &mut ctx.accounts.job_account;
        if job_account.status != JobStatus::InProgress {
            return Err(MyError::JobNotInProgress.into());
        }
        if job_account.provider != ctx.accounts.provider.key() {
            return Err(MyError::WrongProvider.into());
        }
        job_account.results = results;
        job_account.status = JobStatus::PendingVerification;
        job_account.verification_deadline = Clock::get()?.unix_timestamp + 86400;
        msg!("Provider {} submitted results for job {}", ctx.accounts.provider.key(), job_account.key());
        Ok(())
    }
}

// Provider node mới
#[derive(Accounts)]
pub struct ProviderAccount<'info> {
    #[account(
        init,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR_SIZE + Provider::INIT_SPACE,
        seeds = [b"provider", authority.key().as_ref()],
        bump
    )]
    pub provider: Account<'info, Provider>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Provider {
    pub authority: Pubkey,
    pub status: ProviderStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum ProviderStatus {
    Available,
    Busy,
}

// Job
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum JobStatus {
    Pending,
    InProgress,
    Completed,
    PendingVerification,
}

#[account]
#[derive(InitSpace)]
pub struct JobAccount {
    pub renter: Pubkey,
    pub provider: Pubkey,
    pub reward: u64,
    pub status: JobStatus,
    pub job_details: [u8; 32],
    pub results: [u8; 32],
    #[max_len(5)]
    pub failed_providers: Vec<Pubkey>,
    pub verification_deadline: i64,
}

#[derive(Accounts)]
#[instruction(job_details: [u8; 32], reward: u64)]
pub struct CreateJob<'info> {
    #[account(
        init,
        space = ANCHOR_DISCRIMINATOR_SIZE + JobAccount::INIT_SPACE,
        payer = renter,
        seeds = [b"job", renter.key().as_ref(), &job_details],
        bump
    )]
    pub job_account: Account<'info, JobAccount>,
    #[account(
        init,
        payer = renter,
        space = ANCHOR_DISCRIMINATOR_SIZE+ Escrow::INIT_SPACE,
        seeds = [b"escrow", job_account.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub renter: Signer<'info>,
    pub system_program: Program<'info, System>,
}
#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub balance: u64,
}
#[derive(Accounts)]
#[instruction(job_renter: Pubkey, job_details: [u8; 32])]
pub struct AcceptJob<'info> {
    #[account(
        mut,
        seeds = [b"job",  job_renter.as_ref(), job_details.as_ref()],
        bump
    )]
    pub job_account: Account<'info, JobAccount>,
    #[account(
        mut,
        seeds = [b"provider", provider.key().as_ref()],
        bump
    )]
    pub provider_account: Account<'info, Provider>,
    pub provider: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(job_renter: Pubkey, job_details: [u8; 32])]
pub struct SubmitResults<'info> {
    #[account(
        mut,
        seeds = [b"job", job_renter.as_ref(), job_details.as_ref()],
        bump
    )]
    pub job_account: Account<'info, JobAccount>,
    pub provider: Signer<'info>,
    pub system_program: Program<'info, System>,
}