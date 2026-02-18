'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

const findings = [
  {
    id: 'M-01',
    severity: 'medium',
    title: 'Unfillable Dust Orders via Strategic Partial Fills',
    description: 'Due to integer rounding in fill calculations, an attacker could strategically partial-fill an order to leave a remainder smaller than the minimum fillable amount, making the order unfillable.',
    status: 'Acknowledged',
    note: 'The allOrNothing flag provides opt-in protection for users concerned about dust attacks. Economic impact is limited to gas costs for cancellation, an acceptable trade-off for supporting partial fills.',
  },
  {
    id: 'M-02',
    severity: 'medium',
    title: 'Front-Running Cancellation Griefing',
    description: 'An attacker could front-run a cancellation transaction with a fill using a problematic token. Graceful failure handling in proceeds collection mitigates the worst-case scenario — the user still receives their sell token refund and working token proceeds.',
    status: 'Acknowledged',
    note: 'Impact is limited: user receives unwanted proceeds tokens + partial refund instead of full refund. Inherent to public mempool visibility, not specific to AgoraX.',
  },
  {
    id: 'L-01',
    severity: 'low',
    title: 'No Minimum Order Size Allows Order Book Pollution',
    description: 'There is no minimum order size, theoretically allowing order book pollution with very small orders.',
    status: 'Acknowledged',
    note: 'The listing fee (e.g., 100 PLS) acts as an economic deterrent, making spam attacks economically unfeasible.',
  },
  {
    id: 'L-02',
    severity: 'low',
    title: 'Cooldown Upper Bound of 24 Hours',
    description: 'The maximum cooldown period of 86,400 seconds (24 hours) could theoretically be used to DOS the protocol by a compromised admin.',
    status: 'Acknowledged',
    note: 'Two-step ownership transfer (Ownable2Step) prevents accidental admin changes. Normal operation uses short cooldowns (e.g., 60 seconds). Intentional design range.',
  },
  {
    id: 'L-03',
    severity: 'low',
    title: 'validOrderID Modifier Allows Order ID 0',
    description: 'The validOrderID modifier checks _orderID <= orderCounter but does not reject _orderID == 0. Since order IDs start at 1, ID 0 is never valid. All functions with validOrderID have additional checks that reject order 0, so there is no direct security impact.',
    status: 'Confirmed',
    note: 'No exploitable impact. getOrderDetails(0) reverts with array out-of-bounds rather than a descriptive message. Minor code clarity issue.',
  },
  {
    id: 'L-04',
    severity: 'low',
    title: 'cleanInactiveUsers Swap-and-Pop Affects Pagination',
    description: 'cleanInactiveUsers uses a swap-and-pop algorithm to remove inactive users, which reorders the allUsersWithOrders array. If called between paginated findFillableOrders queries, some users may be skipped or double-counted.',
    status: 'Confirmed',
    note: 'Affects frontend pagination consistency only. No fund safety impact. Frontend can re-query from the beginning after cleanup.',
  },
  {
    id: 'L-05',
    severity: 'low',
    title: 'Low-Level Call to Non-Existent Token Treats Empty Return as Success',
    description: 'The graceful failure pattern uses low-level call for ERC20 transfers. If a token contract self-destructs, the EVM returns success = true with empty returndata. The code treats empty return data as success (to support old-style tokens like USDT), which could zero out state without transferring tokens.',
    status: 'Confirmed',
    note: 'Requires a whitelisted token to self-destruct — extremely unlikely. SELFDESTRUCT is deprecated post-Dencun (EIP-6780). Whitelist is owner-controlled, limiting exposure.',
  },
  {
    id: 'I-01',
    severity: 'informational',
    title: 'Fee Address Can Block Protocol if Misconfigured',
    description: 'If the fee address is set to a contract that rejects PLS transfers, listing fee payments would fail, blocking new order creation.',
    status: 'Acknowledged',
    note: 'The updateFeeAddress function provides an escape hatch for fee address issues.',
  },
  {
    id: 'I-02',
    severity: 'informational',
    title: 'Rebase Token Limitations',
    description: 'Rebase tokens are not explicitly handled. Positive rebases lock extra tokens with no withdrawal mechanism. Negative rebases may cause cancellation refunds or proceed transfers to fail if the contract balance dropped.',
    status: 'Confirmed',
    note: 'Fee-on-transfer detection does not catch asynchronous rebase behavior. Avoid whitelisting known rebase tokens.',
  },
  {
    id: 'I-03',
    severity: 'informational',
    title: 'Sell Token Not Validated Against Whitelist',
    description: 'placeOrder validates buy tokens against the whitelist but does not validate the sell token. Any ERC20 can be used as a sell token. This is a design choice — the sell token is provided by the order creator, and buyers choose whether to fill.',
    status: 'Acknowledged',
    note: 'Intentional design decision. The listing fee acts as a spam deterrent.',
  },
];

const securityFeatures = [
  {
    title: 'Reentrancy Protection',
    implementation: 'ReentrancyGuard on all state-changing externals',
    assessment: 'Strong',
  },
  {
    title: 'Access Control',
    implementation: 'Ownable2Step for two-step ownership transfer',
    assessment: 'Strong',
  },
  {
    title: 'Token Transfer Safety',
    implementation: 'SafeERC20 for deposits; graceful failure for withdrawals',
    assessment: 'Strong',
  },
  {
    title: 'Integer Overflow Protection',
    implementation: 'Solidity 0.8+ automatic checks + Math.mulDiv',
    assessment: 'Strong',
  },
  {
    title: 'Fee-on-Transfer Detection',
    implementation: 'Balance diff checks on all token deposits',
    assessment: 'Strong',
  },
  {
    title: 'MEV Protection',
    implementation: 'Configurable cooldown period (20s–86400s)',
    assessment: 'Adequate',
  },
  {
    title: 'Non-Transferable Receipts',
    implementation: 'AGX transfer/approve/transferFrom all disabled',
    assessment: 'Strong',
  },
  {
    title: 'Graceful Failure Handling',
    implementation: 'Individual token failures in proceeds collection don\'t block other tokens',
    assessment: 'Strong',
  },
  {
    title: 'Selective Recovery',
    implementation: 'collectProceedsByToken for targeted single-token retry',
    assessment: 'Strong',
  },
  {
    title: 'Pause Mechanism',
    implementation: 'Admin can pause new orders/fills; cancel/collect still work',
    assessment: 'Strong',
  },
];

const testCoverage = [
  { category: 'Unit Tests', count: 137 },
  { category: 'Fuzz Tests', count: 5 },
  { category: 'Invariant Tests', count: 4 },
  { category: 'Attack Vector Tests', count: 10 },
  { category: 'Security Audit Tests', count: 40 },
];

const agxInvariants = [
  { invariant: 'Mint amount equals sell amount', verified: true },
  { invariant: 'Burn on cancel equals remaining amount', verified: true },
  { invariant: 'Partial fill + cancel: correct total burn', verified: true },
  { invariant: 'Multi-user multi-order supply accounting', verified: true },
  { invariant: 'No double-counting between collection methods', verified: true },
  { invariant: 'Graceful failure: no AGX burned on failed transfer', verified: true },
];

const feeScenarios = [
  { scenario: 'Fee lowered after order placement', behavior: 'Uses lower current fee' },
  { scenario: 'Fee raised after order placement', behavior: 'Uses lower creation fee' },
  { scenario: 'Zero protocol fee', behavior: 'No fee deducted' },
  { scenario: 'Zero listing fee', behavior: 'Orders accepted with no payment' },
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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Acknowledged': return 'text-white/50';
    case 'Confirmed': return 'text-blue-400';
    default: return 'text-white/60';
  }
};

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'Medium': return 'text-yellow-400';
    case 'Low': return 'text-blue-400';
    default: return 'text-white/60';
  }
};

const getAssessmentColor = (assessment: string) => {
  switch (assessment) {
    case 'Strong': return 'text-green-400';
    case 'Adequate': return 'text-yellow-400';
    default: return 'text-white/60';
  }
};

export default function AuditPage() {
  const totalTests = testCoverage.reduce((sum, t) => sum + t.count, 0);

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
          Comprehensive security assessment of the AgoraX smart contract using manual review with entry-point analysis and invariant-based methodology.
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
            <h2 className="text-xl font-semibold text-green-400 mb-1">Contract Audited — Suitable for Production</h2>
            <p className="text-white/70">No critical or high severity issues found. {totalTests} tests passing across unit, fuzz, invariant, attack vector, and security audit test suites. The contract demonstrates mature security practices.</p>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-white/60 text-sm mb-1">Contract</p>
            <p className="text-white">AgoraX.sol</p>
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
            <p className="text-white/60 text-sm mb-1">Methodology</p>
            <p className="text-white">Entry-point & invariant analysis</p>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          <p className="text-3xl font-bold text-blue-400">5</p>
          <p className="text-white/60 text-sm">Low</p>
        </LiquidGlassCard>
        <LiquidGlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-gray-400">3</p>
          <p className="text-white/60 text-sm">Informational</p>
        </LiquidGlassCard>
      </div>

      {/* Security Features Table */}
      <div className="animated-border rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Security Features Analysis</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-white/60 font-medium">Feature</th>
                <th className="text-left py-2 text-white/60 font-medium">Implementation</th>
                <th className="text-left py-2 text-white/60 font-medium">Assessment</th>
              </tr>
            </thead>
            <tbody>
              {securityFeatures.map((feature, index) => (
                <tr key={index} className="border-b border-white/5">
                  <td className="py-3 text-white font-medium">{feature.title}</td>
                  <td className="py-3 text-white/60">{feature.implementation}</td>
                  <td className={`py-3 font-medium ${getAssessmentColor(feature.assessment)}`}>{feature.assessment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test Coverage */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Test Coverage</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-4">
          {testCoverage.map((t, index) => (
            <div key={index} className="text-center">
              <p className="text-2xl font-bold text-white">{t.count}</p>
              <p className="text-white/60 text-xs">{t.category}</p>
            </div>
          ))}
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{totalTests}</p>
            <p className="text-green-400/60 text-xs font-medium">Total Passing</p>
          </div>
        </div>
      </LiquidGlassCard>

      {/* AGX Token Invariants */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">AGX Token Invariant Analysis</h2>
        <p className="text-white/60 text-sm mb-4">
          AGX receipt tokens are minted 1:1 with sell amounts and burned during proceeds collection and cancellation. All invariants verified:
        </p>
        <div className="grid md:grid-cols-2 gap-2">
          {agxInvariants.map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-white/70 text-sm">
              <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {item.invariant}
            </div>
          ))}
        </div>
      </LiquidGlassCard>

      {/* Protocol Fee Analysis */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Protocol Fee Analysis</h2>
        <p className="text-white/60 text-sm mb-4">
          The min(creationFee, currentFee) pattern ensures fairness — orders lock in the fee rate at creation time, and users always pay the lower of the two rates.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-white/60 font-medium">Scenario</th>
                <th className="text-left py-2 text-white/60 font-medium">Behavior</th>
                <th className="text-left py-2 text-white/60 font-medium">Verified</th>
              </tr>
            </thead>
            <tbody>
              {feeScenarios.map((item, index) => (
                <tr key={index} className="border-b border-white/5">
                  <td className="py-2 text-white">{item.scenario}</td>
                  <td className="py-2 text-white/60">{item.behavior}</td>
                  <td className="py-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>

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
            <span className="text-white font-medium">Two-Step Ownership:</span> The contract uses Ownable2Step requiring the current owner to propose a new owner, who must then accept. This prevents accidental ownership transfer and single-transaction ownership hijacking.
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
                <span className={`text-xs ${getStatusColor(finding.status)}`}>
                  {finding.status}
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
                <td className="py-2 text-white/70">20–86400</td>
                <td className="py-2 text-white/60">Seconds (20s to 24h)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>

      {/* Recommendations Summary */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Recommendations Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-white/60 font-medium">Priority</th>
                <th className="text-left py-2 text-white/60 font-medium">ID</th>
                <th className="text-left py-2 text-white/60 font-medium">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/5">
                <td className="py-2 text-blue-400 text-xs font-medium">Consider</td>
                <td className="py-2 text-white font-mono text-xs">L-03</td>
                <td className="py-2 text-white/60">Add _orderID &gt; 0 check to validOrderID modifier</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 text-blue-400 text-xs font-medium">Consider</td>
                <td className="py-2 text-white font-mono text-xs">L-05</td>
                <td className="py-2 text-white/60">Add extcodesize check before low-level transfer</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 text-white/50 text-xs font-medium">Document</td>
                <td className="py-2 text-white font-mono text-xs">L-04</td>
                <td className="py-2 text-white/60">Note pagination impact of cleanInactiveUsers</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 text-white/50 text-xs font-medium">Document</td>
                <td className="py-2 text-white font-mono text-xs">I-02</td>
                <td className="py-2 text-white/60">Document rebase token limitations</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 text-white/40 text-xs font-medium">By Design</td>
                <td className="py-2 text-white font-mono text-xs">M-01</td>
                <td className="py-2 text-white/60">Dust orders — allOrNothing flag mitigates</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 text-white/40 text-xs font-medium">By Design</td>
                <td className="py-2 text-white font-mono text-xs">M-02</td>
                <td className="py-2 text-white/60">Front-run cancellation — mitigated by graceful failure</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 text-white/40 text-xs font-medium">By Design</td>
                <td className="py-2 text-white font-mono text-xs">L-01</td>
                <td className="py-2 text-white/60">No minimum order size — listing fee deters spam</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 text-white/40 text-xs font-medium">By Design</td>
                <td className="py-2 text-white font-mono text-xs">L-02</td>
                <td className="py-2 text-white/60">Cooldown upper bound — intentional range</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>

      {/* Conclusion */}
      <LiquidGlassCard className="p-6 bg-green-500/5 border border-green-500/20">
        <h2 className="text-xl font-semibold text-white mb-4">Conclusion</h2>
        <p className="text-white/70 mb-4">
          No Critical or High severity findings were identified. The contract demonstrates mature security practices with comprehensive protections:
        </p>
        <ul className="grid md:grid-cols-2 gap-2 mb-4">
          {[
            'Reentrancy Protection',
            'Transfer Verification',
            'Cooldown Mechanism',
            'Graceful Failure Handling',
            'Immutable Fee Caps',
            'No Oracle Dependency',
            'Two-Step Ownership',
            'Non-Transferable Tokens',
            'Selective Proceeds Recovery',
            'Fee-on-Transfer Detection',
          ].map((item, index) => (
            <li key={index} className="flex items-center gap-2 text-white/70">
              <span className="text-green-400">&#10003;</span> {item}
            </li>
          ))}
        </ul>
        <p className="text-white/70">
          The contract is suitable for production deployment. The remaining Low-severity recommendations (L-03, L-04, L-05) are quality improvements that can be addressed at the team&apos;s discretion. Users should be aware of the dust order edge case (use allOrNothing for protection) and understand that the listing fee serves as anti-spam protection.
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
