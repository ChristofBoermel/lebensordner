import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const getResend = () => new Resend(process.env.RESEND_API_KEY)

const getSupabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export interface EmailData {
  from: string
  to: string
  subject: string
  html: string
  attachments?: {
    filename: string
    content: Buffer | string
    contentType?: string
  }[]
}

export interface SendEmailResult {
  success: boolean
  timedOut: boolean
  /** True if the send is still in-flight (wasn't canceled). Caller should NOT queue retry. */
  pendingInFlight?: boolean
  error?: string
  messageId?: string
}

/**
 * Sends an email with a configurable timeout to prevent long waits.
 * Uses Promise.race() to detect timeout, but allows in-flight sends to complete.
 *
 * When timeout fires before send completes, the send continues in background.
 * The pendingInFlight flag indicates the send wasn't canceled and may still succeed.
 * Callers should NOT queue retry when pendingInFlight is true to avoid duplicates.
 *
 * @param emailData - The email data to send
 * @param timeoutMs - Timeout in milliseconds (default: 10000ms / 10 seconds)
 * @param onBackgroundComplete - Optional callback when background send completes after timeout
 * @returns SendEmailResult with success status and optional error
 */
export async function sendEmailWithTimeout(
  emailData: EmailData,
  timeoutMs: number = 10000,
  onBackgroundComplete?: (result: SendEmailResult) => void
): Promise<SendEmailResult> {
  const startTime = Date.now()
  let sendCompleted = false
  let timeoutFired = false

  // Create timeout promise
  const timeoutPromise = new Promise<SendEmailResult>((resolve) => {
    setTimeout(() => {
      timeoutFired = true
      if (!sendCompleted) {
        resolve({
          success: false,
          timedOut: true,
          pendingInFlight: true, // Send is still in-flight, don't queue retry
          error: `Email sending timed out after ${timeoutMs}ms`,
        })
      }
    }, timeoutMs)
  })

  // Create email sending promise
  const emailPromise = (async (): Promise<SendEmailResult> => {
    try {
      const response = await getResend().emails.send(emailData)
      sendCompleted = true

      const result: SendEmailResult = response.error
        ? {
            success: false,
            timedOut: false,
            error: response.error.message,
          }
        : {
            success: true,
            timedOut: false,
            messageId: response.data?.id,
          }

      // If timeout already fired, this is a background completion
      if (timeoutFired && onBackgroundComplete) {
        onBackgroundComplete(result)
      }

      return result
    } catch (error: any) {
      sendCompleted = true
      const result: SendEmailResult = {
        success: false,
        timedOut: false,
        error: error.message || 'Unknown error sending email',
      }

      // If timeout already fired, this is a background completion
      if (timeoutFired && onBackgroundComplete) {
        onBackgroundComplete(result)
      }

      return result
    }
  })()

  // Race between email sending and timeout
  const result = await Promise.race([emailPromise, timeoutPromise])

  // Log metrics
  const duration = Date.now() - startTime
  console.log(
    JSON.stringify({
      event: 'email_send_attempt',
      to: emailData.to,
      subject: emailData.subject.substring(0, 50),
      duration_ms: duration,
      success: result.success,
      timed_out: result.timedOut,
      pending_in_flight: result.pendingInFlight || false,
      error: result.error || null,
      timestamp: new Date().toISOString(),
    })
  )

  return result
}

/**
 * Calculates the next retry time using exponential backoff.
 * Base delay is 5 minutes, doubling with each retry, capped at 24 hours.
 *
 * @param retryCount - Current retry count
 * @returns Next retry timestamp as ISO string
 */
export function calculateNextRetryTime(retryCount: number): string {
  const baseDelayMs = 5 * 60 * 1000 // 5 minutes
  const maxDelayMs = 24 * 60 * 60 * 1000 // 24 hours

  const delayMs = Math.min(baseDelayMs * Math.pow(2, retryCount), maxDelayMs)
  return new Date(Date.now() + delayMs).toISOString()
}

/**
 * Adds a failed email to the retry queue with exponential backoff.
 *
 * @param trustedPersonId - ID of the trusted person whose email failed
 * @param error - Error message from the failed attempt
 * @param currentRetryCount - Current retry count (default: 0)
 */
export async function addToRetryQueue(
  trustedPersonId: string,
  error: string,
  currentRetryCount: number = 0
): Promise<void> {
  const supabase = getSupabaseAdmin()

  const nextRetryAt = calculateNextRetryTime(currentRetryCount)

  const { error: insertError } = await supabase.from('email_retry_queue').insert({
    trusted_person_id: trustedPersonId,
    retry_count: currentRetryCount,
    last_error: error,
    next_retry_at: nextRetryAt,
    status: 'pending',
  })

  if (insertError) {
    console.error('Failed to add to retry queue:', insertError)
  } else {
    console.log(
      JSON.stringify({
        event: 'email_queued_for_retry',
        trusted_person_id: trustedPersonId,
        retry_count: currentRetryCount,
        next_retry_at: nextRetryAt,
        error: error,
        timestamp: new Date().toISOString(),
      })
    )
  }
}

/**
 * Updates the email status of a trusted person.
 *
 * @param trustedPersonId - ID of the trusted person
 * @param status - New email status
 * @param additionalFields - Additional fields to update
 */
export async function updateEmailStatus(
  trustedPersonId: string,
  status: 'pending' | 'sending' | 'sent' | 'failed',
  additionalFields: {
    email_sent_at?: string | null
    email_error?: string | null
    email_retry_count?: number
  } = {}
): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { error } = await supabase
    .from('trusted_persons')
    .update({
      email_status: status,
      ...additionalFields,
    })
    .eq('id', trustedPersonId)

  if (error) {
    console.error('Failed to update email status:', error)
  }
}

/**
 * Maximum number of retry attempts before marking as permanently failed.
 */
export const MAX_RETRY_ATTEMPTS = 5

/**
 * Default timeout for email sending in milliseconds.
 */
export const DEFAULT_EMAIL_TIMEOUT_MS = 10000
