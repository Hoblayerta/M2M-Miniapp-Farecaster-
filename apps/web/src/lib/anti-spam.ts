/**
 * Anti-spam protection system for XMTP messaging
 * Implements rate limiting and address blocking/allowing
 */
export class AntiSpamProtection {
  private messageCount = new Map<string, { count: number; resetAt: number }>()
  private blockedAddresses = new Set<string>()
  private allowedAddresses = new Set<string>()

  private readonly MAX_MESSAGES_PER_HOUR = 50
  private readonly HOUR_MS = 60 * 60 * 1000

  /**
   * Check if a message from this sender should be blocked
   */
  shouldBlock(senderAddress: string): boolean {
    const addr = senderAddress.toLowerCase()

    // Whitelist takes priority
    if (this.allowedAddresses.has(addr)) {
      return false
    }

    // Block if in blocklist
    if (this.blockedAddresses.has(addr)) {
      return true
    }

    // Check rate limiting
    return this.isRateLimited(addr)
  }

  /**
   * Check if sender has exceeded rate limit
   */
  private isRateLimited(address: string): boolean {
    const now = Date.now()
    const record = this.messageCount.get(address)

    if (!record || now > record.resetAt) {
      // Reset counter
      this.messageCount.set(address, {
        count: 1,
        resetAt: now + this.HOUR_MS,
      })
      return false
    }

    // Increment counter
    record.count++

    if (record.count > this.MAX_MESSAGES_PER_HOUR) {
      console.warn(`⚠️ Rate limit exceeded for ${address}`)
      return true
    }

    return false
  }

  /**
   * Manually block an address
   */
  block(address: string): void {
    this.blockedAddresses.add(address.toLowerCase())
    console.log(`🚫 Blocked address: ${address}`)
  }

  /**
   * Unblock an address
   */
  unblock(address: string): void {
    this.blockedAddresses.delete(address.toLowerCase())
    console.log(`✅ Unblocked address: ${address}`)
  }

  /**
   * Add address to allowlist (bypass all checks)
   */
  allow(address: string): void {
    this.allowedAddresses.add(address.toLowerCase())
    console.log(`✅ Added to allowlist: ${address}`)
  }

  /**
   * Remove address from allowlist
   */
  disallow(address: string): void {
    this.allowedAddresses.delete(address.toLowerCase())
    console.log(`🚫 Removed from allowlist: ${address}`)
  }

  /**
   * Get remaining messages for an address this hour
   */
  getRemainingMessages(address: string): number {
    const addr = address.toLowerCase()

    if (this.allowedAddresses.has(addr)) {
      return Infinity
    }

    if (this.blockedAddresses.has(addr)) {
      return 0
    }

    const now = Date.now()
    const record = this.messageCount.get(addr)

    if (!record || now > record.resetAt) {
      return this.MAX_MESSAGES_PER_HOUR
    }

    return Math.max(0, this.MAX_MESSAGES_PER_HOUR - record.count)
  }

  /**
   * Check if address is blocked
   */
  isBlocked(address: string): boolean {
    return this.blockedAddresses.has(address.toLowerCase())
  }

  /**
   * Check if address is allowed
   */
  isAllowed(address: string): boolean {
    return this.allowedAddresses.has(address.toLowerCase())
  }

  /**
   * Clear all rate limiting data (for testing)
   */
  clearRateLimits(): void {
    this.messageCount.clear()
    console.log('🧹 Cleared all rate limit data')
  }
}

// Global instance
export const antiSpam = new AntiSpamProtection()
