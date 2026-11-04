-- Accounts created before email delivery was enabled were marked verified
-- without mailbox proof. Require every existing account to verify ownership.
update public.users set email_verified=false where email_verified=true;
update public.refresh_sessions
set revoked_at=now()
where revoked_at is null;
delete from public.email_verification_tokens;
