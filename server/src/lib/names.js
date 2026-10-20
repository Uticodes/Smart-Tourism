/**
 * The only name shown to the public for a user (Section 3.8.2): the display name they chose,
 * or, if they never set one, the first word of their full name. Never the full name or email.
 */
function publicName(displayName, fullName) {
  if (displayName && displayName.trim()) return displayName.trim();
  if (fullName && fullName.trim()) return fullName.trim().split(/\s+/)[0];
  return null;
}

module.exports = { publicName };
