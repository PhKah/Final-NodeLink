use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("Afn7mniibRXcMvergvr1Q6BnF3vEDkJop1XSHrTXJLTR");

const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;
const VERIFY_DURATION: i64 = 600; 
const BASE_BAN_DURATION: i64 = 3600;

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
    #[msg("Job is not pending verification.")]
    JobNotPendingVerification,
    #[msg("The verification deadline has not yet passed.")]
    VerificationDeadlineNotPassed,
    #[msg("Provider is currently banned or not available.")]
    ProviderBannedOrBusy,
    #[msg("The submission deadline has not yet passed.")]
    SubmissionDeadlineNotPassed,
    #[msg("Job is not in a state where payment can be claimed.")]
    JobNotClaimable,
}

fn apply_penalty(provider: &mut Account<Provider>) -> Result<()> {
    provider.jobs_failed = provider.jobs_failed.checked_add(1).unwrap();

    let total_jobs = provider.jobs_completed.checked_add(provider.jobs_failed).unwrap();
    
    let ban_duration: i64;
    if total_jobs > 0 {
        let numerator: u128 = (BASE_BAN_DURATION as u128).checked_mul(provider.jobs_failed as u128).unwrap();
        let ban_duration_u128 = numerator.checked_div(total_jobs as u128).unwrap();
        ban_duration = ban_duration_u128 as i64;
    } else {
        ban_duration = BASE_BAN_DURATION;
    }

    let now = Clock::get()?.unix_timestamp;
    provider.banned_until = now.checked_add(ban_duration).unwrap();
    provider.status = ProviderStatus::Available;

    msg!(
        "Provider {} has been penalized. Banned until timestamp: {}",
        provider.authority,
        provider.banned_until
    );

    Ok(())
}

#[program]
pub mod node_link {
    use super::*;

    pub fn initialize_counter(ctx: Context<InitializeCounter>) -> Result<()> {
        ctx.accounts.counter.count = 0;
        msg!("Counter initialized");
        Ok(())
    }

    pub fn provider_register(ctx: Context<ProviderAccount>, job_tags: String, hardware_config: String) -> Result<()> {
        ctx.accounts.provider.set_inner(Provider {
            authority: ctx.accounts.authority.key(),
            status: ProviderStatus::Available,
            supported_job_tags: job_tags,
            hardware_config: hardware_config,
            jobs_completed: 0,
            jobs_failed: 0,
            banned_until: 0,
        });
        msg!("Provider registered for authority: {}", ctx.accounts.authority.key());
        Ok(())
    }

    pub fn create_job(ctx: Context<CreateJob>, reward: u64, engine: ExecutionEngine, job_tags: String, hardware_tags: String,job_details: String, max_duration: i64) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        let job_id = counter.count;

        ctx.accounts.job_account.set_inner(JobAccount {
            job_id,
            renter: ctx.accounts.renter.key(),
            provider: Pubkey::default(),
            reward,
            status: JobStatus::Pending,
            engine,
            job_tags,
            hardware_tags,
            results: String::new(),
            failed_providers: Vec::new(),
            verification_deadline: 0,
            max_duration,
            submission_deadline: 0,
            job_details: job_details,
        });

        counter.count = counter.count.checked_add(1).unwrap();

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.renter.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        );
        transfer(cpi_context, reward)?;
        msg!("Created job with ID: {}", job_id);
        Ok(())
    }

    pub fn accept_job(ctx: Context<AcceptJob>, _job_id: u64) -> Result<()> {
        let job_account = &mut ctx.accounts.job_account;
        let provider_account = &mut ctx.accounts.provider_account;
        let now = Clock::get()?.unix_timestamp;

        require!(provider_account.status == ProviderStatus::Available && provider_account.banned_until < now, MyError::ProviderBannedOrBusy);
        require!(job_account.status == JobStatus::Pending, MyError::JobNotPending);
        require!(!job_account.failed_providers.contains(&ctx.accounts.provider.key()), MyError::ProviderPreviouslyFailed);

        job_account.provider = ctx.accounts.provider.key();
        job_account.status = JobStatus::InProgress;
        job_account.submission_deadline = now.checked_add(job_account.max_duration).unwrap();
        job_account.verification_deadline = job_account.submission_deadline.checked_add(VERIFY_DURATION).unwrap();

        provider_account.status = ProviderStatus::Busy;
        
        msg!("Provider {} accepted job {}", ctx.accounts.provider.key(), job_account.job_id);
        Ok(())
    }

    pub fn submit_results(ctx: Context<SubmitResults>, _job_id: u64, results: String) -> Result<()> {
        let job_account = &mut ctx.accounts.job_account;
        let provider_account = &mut ctx.accounts.provider_account;

        require!(job_account.status == JobStatus::InProgress, MyError::JobNotInProgress);

        job_account.results = results;
        job_account.status = JobStatus::PendingVerification;
        
        provider_account.status = ProviderStatus::Available;

        msg!("Provider {} submitted results for job {}", ctx.accounts.provider.key(), job_account.job_id);
        Ok(())
    }

    pub fn verify_results(ctx: Context<VerifyResults>, _job_id: u64, is_accepted: bool) -> Result<()> {
        let job_account = &mut ctx.accounts.job_account;
        let provider_account = &mut ctx.accounts.provider_account;

        require!(job_account.status == JobStatus::PendingVerification, MyError::JobNotPendingVerification);

        if is_accepted {
            provider_account.jobs_completed = provider_account.jobs_completed.checked_add(1).unwrap();
            job_account.status = JobStatus::Completed;
            msg!("Renter {} accepted results for job {}", job_account.renter, job_account.job_id);
        } else {
            let provider_key = job_account.provider;
            job_account.failed_providers.push(provider_key);
            job_account.provider = Pubkey::default();
            job_account.status = JobStatus::Pending;
            
            apply_penalty(provider_account)?;
            msg!("Renter {} rejected results for job {}", job_account.renter, job_account.job_id);
        }
        Ok(())
    }

    pub fn claim_payment(ctx: Context<ClaimPayment>, _job_id: u64) -> Result<()> {
        let job_account = &mut ctx.accounts.job_account;
        let provider_account = &mut ctx.accounts.provider_account;
        let now = Clock::get()?.unix_timestamp;

        let is_deadline_passed = now > job_account.verification_deadline;

        if job_account.status == JobStatus::PendingVerification && is_deadline_passed {
            provider_account.jobs_completed = provider_account.jobs_completed.checked_add(1).unwrap();
            job_account.status = JobStatus::Completed;
        } 
        else if job_account.status != JobStatus::Completed {
            return err!(MyError::JobNotClaimable);
        }

        provider_account.status = ProviderStatus::Available;

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.provider.to_account_info(),
            }
        );
        transfer(cpi_context, job_account.reward)?;

        msg!("Provider {} claimed payment for job {}", job_account.provider, job_account.job_id);
        Ok(())
    }

    pub fn cancel_job(ctx: Context<CancelJob>, _job_id: u64) -> Result<()> {
        require!(ctx.accounts.job_account.status == JobStatus::Pending, MyError::JobNotPending);
        msg!("Renter {} canceled job {}", ctx.accounts.renter.key(), ctx.accounts.job_account.job_id);
        Ok(())
    }

    pub fn reclaim_job(ctx: Context<ReclaimJob>, _job_id: u64) -> Result<()> {
        let job_account = &mut ctx.accounts.job_account;
        let provider_account = &mut ctx.accounts.provider_account;

        require!(job_account.status == JobStatus::InProgress, MyError::JobNotInProgress);
        require!(Clock::get()?.unix_timestamp > job_account.submission_deadline, MyError::SubmissionDeadlineNotPassed);

        let failed_provider = job_account.provider;
        job_account.failed_providers.push(failed_provider);
        job_account.provider = Pubkey::default();
        job_account.status = JobStatus::Pending;

        apply_penalty(provider_account)?;
        msg!("Renter {} reclaimed job {} due to timeout", job_account.renter.key(), job_account.job_id);
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum ExecutionEngine {
    Docker,
}

#[account]
#[derive(InitSpace, Default)]
pub struct JobCounter {
    pub count: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Provider {
    pub authority: Pubkey,
    pub status: ProviderStatus,
    #[max_len(100)]
    pub supported_job_tags: String,
    #[max_len(100)]
    pub hardware_config: String,
    pub jobs_completed: u64,
    pub jobs_failed: u64,
    pub banned_until: i64,
}

#[derive(Accounts)]
pub struct ProviderAccount<'info> {
    #[account(init, payer = authority, space = 8 + Provider::INIT_SPACE, seeds = [b"provider", authority.key().as_ref()], bump)]
    pub provider: Account<'info, Provider>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum ProviderStatus {
    Available,
    Busy,
}

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
    pub job_id: u64,
    pub renter: Pubkey,
    pub provider: Pubkey,
    pub reward: u64,
    pub status: JobStatus,
    pub engine: ExecutionEngine,
    #[max_len(100)]
    pub job_tags: String,
    #[max_len(100)]
    pub hardware_tags: String,
    #[max_len(100)]
    pub results: String,
    #[max_len(5)]
    pub failed_providers: Vec<Pubkey>,
    #[max_len(100)]
    pub job_details: String,
    pub verification_deadline: i64,
    pub max_duration: i64,
    pub submission_deadline: i64,
}

#[account]
#[derive(Default)]
pub struct Escrow;

#[derive(Accounts)]
pub struct CreateJob<'info> {
    #[account(init, payer = renter, space = 8 + JobAccount::INIT_SPACE, seeds = [b"job", counter.count.to_le_bytes().as_ref()], bump)]
    pub job_account: Account<'info, JobAccount>,
    #[account(init, payer = renter, space = 8, seeds = [b"escrow", job_account.key().as_ref()], bump)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub renter: Signer<'info>,
    #[account(mut, seeds = [b"counter"], bump)]
    pub counter: Account<'info, JobCounter>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct AcceptJob<'info> {
    #[account(mut, seeds = [b"job", &job_id.to_le_bytes()], bump)]
    pub job_account: Account<'info, JobAccount>,
    #[account(mut, seeds = [b"provider", provider.key().as_ref()], bump)]
    pub provider_account: Account<'info, Provider>,
    pub provider: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct SubmitResults<'info> {
    #[account(mut, seeds = [b"job", &job_id.to_le_bytes()], bump, has_one = provider)]
    pub job_account: Account<'info, JobAccount>,
    #[account(mut, seeds = [b"provider", provider.key().as_ref()], bump)]
    pub provider_account: Account<'info, Provider>,
    pub provider: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct VerifyResults<'info> {
    #[account(mut, seeds = [b"job", &job_id.to_le_bytes()], bump, has_one = renter)]
    pub job_account: Account<'info, JobAccount>,
    pub renter: Signer<'info>,
    #[account(
        mut,
        seeds = [b"provider", job_account.provider.as_ref()],
        bump,
        constraint = provider_account.authority == job_account.provider
    )]
    pub provider_account: Account<'info, Provider>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct ClaimPayment<'info> {
    #[account(mut, seeds = [b"job", &job_id.to_le_bytes()], bump, has_one = provider)]
    pub job_account: Account<'info, JobAccount>,
    #[account(mut, seeds = [b"escrow", job_account.key().as_ref()], bump)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub provider: Signer<'info>,
    #[account(mut, seeds = [b"provider", provider.key().as_ref()], bump)]
    pub provider_account: Account<'info, Provider>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct CancelJob<'info> {
    #[account(mut, close = renter, seeds = [b"job", &job_id.to_le_bytes()], bump, has_one = renter)]
    pub job_account: Account<'info, JobAccount>,
    #[account(mut, close = renter, seeds = [b"escrow", job_account.key().as_ref()], bump)]
    pub escrow: Account<'info, Escrow>,
    pub renter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct ReclaimJob<'info> {
    #[account(mut, seeds = [b"job", &job_id.to_le_bytes()], bump, has_one = renter)]
    pub job_account: Account<'info, JobAccount>,
    #[account(
        mut,
        seeds = [b"provider", job_account.provider.as_ref()],
        bump,
        constraint = provider_account.authority == job_account.provider
    )]
    pub provider_account: Account<'info, Provider>,
    pub renter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeCounter<'info> {
    #[account(init, payer = user, space = 8 + 8, seeds = [b"counter"], bump)]
    pub counter: Account<'info, JobCounter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
