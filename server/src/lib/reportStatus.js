/**
 * Site report life cycle (Section 3.7.4, FR-13, FR-14).
 *
 *   pending ──3 confirmations──▶ under_review
 *   pending | under_review | needs_info ──admin──▶ approved | rejected | needs_info
 *   needs_info ──reporter updates the details──▶ pending
 *   approved and rejected are final.
 *
 * Community flags never change the status; they hide a report from the public list
 * once there are at least 3 flags and more flags than confirmations. An admin still sees it.
 */
const CONFIRMS_FOR_REVIEW = 3;
const FLAGS_TO_HIDE = 3;

const OPEN = ['pending', 'under_review', 'needs_info'];
const COMMUNITY_CAN_RESPOND = ['pending', 'under_review'];

const ADMIN_ACTIONS = {
  approve: 'approved',
  reject: 'rejected',
  needs_info: 'needs_info',
};

function canAdminDecide(status) {
  return OPEN.includes(status);
}

/** Status and visibility after a community response has been counted. */
function afterResponse({ status, confirm_count: confirms, flag_count: flags, is_hidden: hidden }) {
  return {
    status: status === 'pending' && confirms >= CONFIRMS_FOR_REVIEW ? 'under_review' : status,
    is_hidden: Boolean(hidden) || (flags >= FLAGS_TO_HIDE && flags > confirms),
  };
}

module.exports = { CONFIRMS_FOR_REVIEW, FLAGS_TO_HIDE, OPEN, COMMUNITY_CAN_RESPOND, ADMIN_ACTIONS, canAdminDecide, afterResponse };
