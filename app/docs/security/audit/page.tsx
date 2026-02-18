'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

const findings = [
  {
    id: 'L-01',
    severity: 'low',
    title: 'Dust Orders via Strategic Partial Fills',
    description: 'Due to integer rounding in fill calculations, an attacker could theoretically fill an order to leave a remainder smaller than the minimum fillable amount.',
    note: 'Mitigated by allOrNothing flag - users creating orders with ratios that could result in dust should use allOrNothing = true',
  },
  {
    id: 'L-02',
    severity: 'low',
    title: 'No Minimum Order Size',
    description: 'There is no minimum order size, theoretically allowing order book pollution with very small orders.',
    note: 'The listing fee (e.g., 100 PLS) acts as an economic deterrent, making spam attacks economically unfeasible',
  },
  {
    id: 'L-03',
    severity: 'low',
    title: 'Cooldown Upper Bound of 24 Hours',
    description: 'The maximum cooldown period of 86400 seconds (24 hours) could theoretically be used maliciously by a compromised admin.',
    note: 'Two-step ownership transfer (Ownable2Step) prevents accidental admin changes. Normal operation uses short cooldowns (e.g., 60 seconds)',
  },
  {
    id: 'I-01',
    severity: 'informational',
    title: 'Non-Transferable Receipt Tokens',
    description: 'AGX receipt tokens cannot be transferred, traded, or approved. This is an intentional security feature that prevents accidental loss of order access and eliminates secondary market attack vectors.',
  },
  {
    id: 'I-02',
    severity: 'informational',
    title: 'No Price Oracle Dependency',
    description: 'The contract has zero reliance on external price oracles, eliminating oracle manipulation, flash loan + oracle attacks, stale price exploitation, and oracle downtime issues. Order pricing is purely peer-to-peer.',
  },
  {
    id: 'I-03',
    severity: 'informational',
    title: 'Immutable Fee Caps',
    description: 'Fee limits (PROTOCOL_FEES_LIMIT and LISTING_FEES_LIMIT) are set at deployment and cannot be changed, providing users with permanent guarantees about maximum possible fees.',
  },
];

const securityFeatures = [
  {
    title: 'Reentrancy Protection',
    description: 'All state-changing external functions (placeOrder, cancelOrder, fillOrder, collectProceeds, etc.) use the nonReentrant modifier from OpenZeppelin\'s ReentrancyGuard.',
  },
  {
    title: 'Transfer Verification',
    description: 'Exact balance checks before and after transfers prevent fee-on-transfer token exploits, deflationary token accounting errors, and rebasing token manipulation.',
  },
  {
    title: 'Cooldown Mechanism',
    description: 'Configurable cooldown period (20 seconds to 24 hours) prevents MEV and flash loan order manipulation attacks.',
  },
  {
    title: 'Graceful Failure Handling',
    description: 'Try/catch-style handling for proceeds collection prevents one failed token transfer from blocking all proceeds. Selective token collection via collectProceedsByToken() is also available.',
  },
  {
    title: 'Immutable Fee Caps',
    description: 'Protocol and listing fee limits are set at deployment and cannot be increased, providing permanent user guarantees.',
  },
  {
    title: 'Grandfathered Fee Protection',
    description: 'Orders lock in the fee rate at creation time, using the lower of creation or current fee when filling.',
  },
  {
    title: 'Non-Transferable Receipt Tokens',
    description: 'AGX tokens are non-transferable by design, preventing accidental loss, social engineering attacks, and complex secondary market exploits.',
  },
  {
    title: 'Direct PLS Transfer Rejection',
    description: 'The receive() function reverts direct PLS transfers, preventing accidental fund loss.',
  },
  {
    title: 'No Oracle Dependency',
    description: 'Zero reliance on external price oracles eliminates oracle manipulation, stale price vulnerabilities, and flash loan oracle attacks.',
  },
];

const ownerCapabilities = [
  { function: 'addTokenAddress()', risk: 'Medium', notes: 'Can whitelist tokens' },
  { function: 'setTokenStatus()', risk: 'Medium', notes: 'Can enable/disable tokens' },
  { function: 'pause() / unpause()', risk: 'Medium', notes: 'Emergency stop' },
  { function: 'updateFeeAddress()', risk: 'Low', notes: 'Fee collection address' },
  { function: 'updateCooldownPeriod()', risk: 'Low', notes: 'Bounded 20-86400s' },
  { function: 'updateListingFee()', risk: 'Low', notes: 'Bounded by immutable cap' },
  { function: 'updateProtocolFee()', risk: 'Low', notes: 'Bounded by immutable cap' },
  { function: 'cleanInactiveUsers()', risk: 'Low', notes: 'Maintenance only' },
];

const ownerRestrictions = [
  'Withdraw user funds',
  'Modify existing orders',
  'Change fee caps (immutable)',
  'Transfer receipt tokens',
  'Access funds during pause',
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

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'Medium': return 'text-yellow-400';
    case 'Low': return 'text-blue-400';
    default: return 'text-white/60';
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
          Comprehensive security assessment of the AgoraX smart contract.
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
            <p className="text-white/70">The AgoraX smart contract demonstrates excellent security fundamentals with comprehensive use of OpenZeppelin libraries. No critical or high severity issues were found.</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-green-500/20">
          <a
            href="https://otter.pulsechain.com/address/0x06856CEa795D001bED91acdf1264CaB174949bf3/contract"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View Verified Contract
          </a>
        </div>
      </LiquidGlassCard>

      {/* Overview */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Audit Overview</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-white/60 text-sm mb-1">Contract</p>
            <p className="text-white">AgoraX-final.sol</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1">Solidity Version</p>
            <p className="text-white">^0.8.17</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1">Audit Date</p>
            <p className="text-white">February 2026</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1">Scope</p>
            <p className="text-white">Security posture, accounting integrity, and mathematical correctness</p>
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
          <p className="text-3xl font-bold text-blue-400">3</p>
          <p className="text-white/60 text-sm">Low</p>
        </LiquidGlassCard>
        <LiquidGlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-gray-400">3</p>
          <p className="text-white/60 text-sm">Informational</p>
        </LiquidGlassCard>
      </div>

      {/* Key Security Features */}
      <div className="animated-border rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Security Features Analysis</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {securityFeatures.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <span className="text-white font-medium">{feature.title}</span>
                <p className="text-white/60 text-sm mt-1">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Access Control Analysis */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Access Control Analysis</h2>

        <h3 className="text-lg font-medium text-white mb-3">Owner Capabilities</h3>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-white/60 font-medium">Function</th>
                <th className="text-left py-2 text-white/60 font-medium">Risk Level</th>
                <th className="text-left py-2 text-white/60 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {ownerCapabilities.map((cap, index) => (
                <tr key={index} className="border-b border-white/5">
                  <td className="py-2 text-white font-mono text-xs">{cap.function}</td>
                  <td className={`py-2 ${getRiskColor(cap.risk)}`}>{cap.risk}</td>
                  <td className="py-2 text-white/60">{cap.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="text-lg font-medium text-white mb-3">Owner Restrictions</h3>
        <p className="text-white/60 mb-2">The owner cannot:</p>
        <ul className="grid md:grid-cols-2 gap-2">
          {ownerRestrictions.map((restriction, index) => (
            <li key={index} className="flex items-center gap-2 text-white/70">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {restriction}
            </li>
          ))}
        </ul>

        <div className="mt-4 p-4 bg-white/5 rounded-lg">
          <p className="text-white/70 text-sm">
            <span className="text-white font-medium">Two-Step Ownership:</span> The contract uses Ownable2Step requiring the current owner to propose a new owner, who must then accept. This prevents accidental ownership transfer to wrong addresses and single-transaction ownership hijacking.
          </p>
        </div>
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
              </div>
              <h3 className="text-white font-medium mb-2">{finding.title}</h3>
              <p className="text-white/60 text-sm">{finding.description}</p>
              {finding.note && (
                <p className="text-white/50 text-sm mt-2 italic">Mitigation: {finding.note}</p>
              )}
            </LiquidGlassCard>
          ))}
        </div>
      </div>

      {/* Key Constants */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Key Constants</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-white/60 font-medium">Constant</th>
                <th className="text-left py-2 text-white/60 font-medium">Value</th>
                <th className="text-left py-2 text-white/60 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/5">
                <td className="py-2 text-white font-mono text-xs">PERCENTAGE_DIVISOR</td>
                <td className="py-2 text-white/70">10000</td>
                <td className="py-2 text-white/60">Basis points denominator</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 text-white font-mono text-xs">NATIVE_ADDRESS</td>
                <td className="py-2 text-white/70">0xEeee...eEEE</td>
                <td className="py-2 text-white/60">PLS sentinel address</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 text-white font-mono text-xs">Batch limit</td>
                <td className="py-2 text-white/70">50</td>
                <td className="py-2 text-white/60">Max items per batch operation</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 text-white font-mono text-xs">Cooldown bounds</td>
                <td className="py-2 text-white/70">20-86400</td>
                <td className="py-2 text-white/60">Seconds (20s to 24h)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>

      {/* Conclusion */}
      <LiquidGlassCard className="p-6 bg-green-500/5 border border-green-500/20">
        <h2 className="text-xl font-semibold text-white mb-4">Conclusion</h2>
        <p className="text-white/70 mb-4">
          The AgoraX-final.sol contract demonstrates strong security practices:
        </p>
        <ul className="grid md:grid-cols-2 gap-2 mb-4">
          <li className="flex items-center gap-2 text-white/70">
            <span className="text-green-400">✓</span> Reentrancy Protection
          </li>
          <li className="flex items-center gap-2 text-white/70">
            <span className="text-green-400">✓</span> Transfer Verification
          </li>
          <li className="flex items-center gap-2 text-white/70">
            <span className="text-green-400">✓</span> Cooldown Mechanism
          </li>
          <li className="flex items-center gap-2 text-white/70">
            <span className="text-green-400">✓</span> Graceful Failure Handling
          </li>
          <li className="flex items-center gap-2 text-white/70">
            <span className="text-green-400">✓</span> Immutable Fee Caps
          </li>
          <li className="flex items-center gap-2 text-white/70">
            <span className="text-green-400">✓</span> No Oracle Dependency
          </li>
          <li className="flex items-center gap-2 text-white/70">
            <span className="text-green-400">✓</span> Two-Step Ownership
          </li>
          <li className="flex items-center gap-2 text-white/70">
            <span className="text-green-400">✓</span> Non-Transferable Tokens
          </li>
        </ul>
        <p className="text-white/70">
          The contract is suitable for mainnet deployment. Users should be aware of the dust order edge case (use allOrNothing for protection) and understand that the listing fee serves as anti-spam protection.
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
