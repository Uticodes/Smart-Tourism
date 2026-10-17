const STYLES = {
  pending: ['Pending', 'bg-granite-100 text-granite-700'],
  under_review: ['Under review', 'bg-[#FDF3D8] text-[#7A5300]'],
  needs_info: ['More info needed', 'bg-laterite-50 text-laterite-600'],
  approved: ['Approved', 'bg-green-50 text-green-700'],
  rejected: ['Not approved', 'bg-[#FBE9E7] text-danger'],
};

export const STATUS_LABEL = Object.fromEntries(Object.entries(STYLES).map(([k, [label]]) => [k, label]));

export default function StatusBadge({ status }) {
  const [label, cls] = STYLES[status] || [status, 'bg-granite-100 text-granite-700'];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}
