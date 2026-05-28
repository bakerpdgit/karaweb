import React from 'react';

/**
 * Tiny filter input above the SubmissionGrid. Case-insensitive
 * substring match against `s.username`. Use case from the spec:
 * a "class" that's actually a year group (e.g. 200 students with
 * usernames like `frbloggs-10A`, `jdoe-10B`) — the teacher types
 * `-10A` and the grid narrows to that form group.
 */
export default function UsernameFilter({ value, onChange, totalCount, shownCount }) {
  return (
    <div className="analyse-filter">
      <label htmlFor="analyse-filter-input">Filter:</label>
      <input
        id="analyse-filter-input"
        type="search"
        placeholder="username substring (e.g. -10A)"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <span className="analyse-filter-count">
        Showing {shownCount} of {totalCount} student{totalCount === 1 ? '' : 's'}
      </span>
      {value && (
        <button
          type="button"
          className="analyse-filter-clear"
          onClick={() => onChange('')}
          aria-label="Clear filter"
        >Clear</button>
      )}
    </div>
  );
}
