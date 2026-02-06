'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

const findings = [
  {
    id: 'M-01',
    severity: 'medium',
    title: 'Incomplete Order Expiry Handling During Fills',
    description: 'When filling an active order that has just expired, the fillOrder function lacks a fresh expiry check after confirming status. This could allow filling an order that expired between checks.',
    status: 'fixed',
  },
  {
    id: 'M-02',
    severity: 'medium',
    title: 'Whitelist Index Bounds Check Missing',
    description: 'The _checkTokenAndAmount function checks if a token index is out of bounds but doesn\'t verify the returned token address is non-zero, which could cause issues with sparse whitelist arrays.',
    status: 'acknowledged',
  },
  {
    id: 'L-01',
    severity: 'low',
    title: 'Missing Event Emission for Whitelist Changes',
    description: 'Adding or modifying whitelist tokens doesn\'t emit events, making it harder to track whitelist changes off-chain.',
    status: 'fixed',
  },
  {
    id: 'L-02',
    severity: 'low',
    title: 'Unbounded Loop in Batch Cancel',
    description: 'cancelAllExpiredOrders iterates through all provided order IDs without an explicit upper bound check in the loop itself.',
    status: 'acknowledged',
    note: 'Limited to 50 orders max by parameter validation',
  },
  {
    id: 'L-03',
    severity: 'low',
    title: 'Cooldown Period Edge Cases',
    description: 'Very short cooldown periods (< 1 minute) could allow rapid order manipulation in edge cases.',
    status: 'fixed',
    note: 'Minimum cooldown enforced at 20 seconds',
  },
  {
    id: 'I-01',
    severity: 'informational',
    title: 'Consider Using SafeERC20',
    description: 'While the contract checks return values, using OpenZeppelin\'s SafeERC20 would provide additional safety for non-compliant tokens.',
    status: 'acknowledged',
  },
  {
    id: 'I-02',
    severity: 'informational',
    title: 'Magic Numbers in Code',
    description: 'Some constants like maximum buy tokens (50) and batch size limits could be extracted to named constants for clarity.',
    status: 'fixed',
  },
  {
    id: 'I-03',
    severity: 'informational',
    title: 'Documentation Improvements',
    description: 'Some function parameters and return values lack comprehensive NatSpec documentation.',
    status: 'fixed',
  },
];

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'fixed': return 'bg-green-500/20 text-green-400';
    case 'acknowledged': return 'bg-yellow-500/20 text-yellow-400';
    default: return 'bg-gray-500/20 text-gray-400';
  }
};

export default function AuditPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/security" className="hover:text-white transition-colors">Security</Link>
          <span>/</span>
          <span className="text-white">Audit Report</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Security Audit Report
        </h1>
        <p className="text-lg text-white/70">
          Summary of the AgoráX smart contract security assessment.
        </p>
      </div>

      {/* Audit Status Banner */}
      <LiquidGlassCard className="p-6 bg-green-500/10 border border-green-500/30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-green-400 mb-1">Contract Audited</h2>
            <p className="text-white/70">The AgoraX smart contract has been audited. No critical or high severity issues were found.</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-green-500/20">
          <a
            href="/docs/SECURITY_AUDIT_FINAL.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Full Audit Report
          </a>
        </div>
      </LiquidGlassCard>

      {/* Overview */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Audit Overview</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-white/60 text-sm mb-1">Contract</p>
            <p className="text-white">AgoraX_mainnet.sol</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1">Network</p>
            <p className="text-white">PulseChain Mainnet</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1">Audit Date</p>
            <p className="text-white">February 2026</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1">Scope</p>
            <p className="text-white">Full contract audit including all user-facing functions</p>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <LiquidGlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-red-400">0</p>
          <p className="text-white/60 text-sm">Critical</p>
        </LiquidGlassCard>
        <LiquidGlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-orange-400">0</p>
          <p className="text-white/60 text-sm">High</p>
        </LiquidGlassCard>
        <LiquidGlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">2</p>
          <p className="text-white/60 text-sm">Medium</p>
        </LiquidGlassCard>
        <LiquidGlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">3</p>
          <p className="text-white/60 text-sm">Low</p>
        </LiquidGlassCard>
      </div>

      {/* Key Security Features */}
      <LiquidGlassCard className="p-6 border-l-4 border-green-500/50">
        <h2 className="text-xl font-semibold text-white mb-4">Key Security Strengths</h2>
        <ul className="space-y-3 text-white/70">
          <li className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong className="text-white">Reentrancy Protection:</strong> All state changes occur before external calls</span>
          </li>
          <li className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong className="text-white">Transfer Validation:</strong> Exact balance checks prevent fee-on-transfer exploits</span>
          </li>
          <li className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong className="text-white">Cooldown Mechanism:</strong> Prevents rapid order manipulation</span>
          </li>
          <li className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong className="text-white">Access Control:</strong> Only order owners can modify their orders</span>
          </li>
          <li className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong className="text-white">Whitelist System:</strong> Protects users from receiving malicious tokens</span>
          </li>
        </ul>
      </LiquidGlassCard>

      {/* Findings */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Detailed Findings</h2>
        <div className="space-y-4">
          {findings.map((finding) => (
            <LiquidGlassCard key={finding.id} className="p-6">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-white font-mono font-semibold">{finding.id}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(finding.severity)}`}>
                  {finding.severity.toUpperCase()}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(finding.status)}`}>
                  {finding.status.toUpperCase()}
                </span>
              </div>
              <h3 className="text-white font-medium mb-2">{finding.title}</h3>
              <p className="text-white/60 text-sm">{finding.description}</p>
              {finding.note && (
                <p className="text-white/50 text-sm mt-2 italic">Note: {finding.note}</p>
              )}
            </LiquidGlassCard>
          ))}
        </div>
      </div>

      {/* Informational */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Additional Informational Items</h2>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>• Gas optimizations possible in iteration patterns</li>
          <li>• Consider implementing EIP-2612 permit for gasless approvals</li>
          <li>• Comprehensive test coverage recommended for edge cases</li>
        </ul>
      </LiquidGlassCard>

      {/* Conclusion */}
      <LiquidGlassCard className="p-6 bg-green-500/5 border border-green-500/20">
        <h2 className="text-xl font-semibold text-white mb-4">Conclusion</h2>
        <p className="text-white/70">
          The AgoráX smart contract demonstrates a solid security foundation with proper access controls,
          reentrancy protection, and input validation. The identified medium-severity issues have been
          addressed or acknowledged with appropriate mitigations. The contract is considered safe for
          production use with the noted considerations.
        </p>
      </LiquidGlassCard>

      {/* Navigation */}
      <div className="flex flex-col md:flex-row gap-4 pt-4">
        <Link href="/docs/technical/data-structures" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">Data Structures</p>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/security/features" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Security Features</p>
              </div>
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </LiquidGlassCard>
        </Link>
      </div>
    </div>
  );
}
