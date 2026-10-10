/** Houston local datetime-local values for time-entry edits. */

export const CENTRAL_TIMEZONE = 'America/Chicago';

// Convert UTC datetime string to Central Time datetime-local format
export const toCentralDateTime = (utcString) => {
  if (!utcString) return '';
  try {
    const utcDate = new Date(utcString);
    if (isNaN(utcDate.getTime())) return '';

    // Use Intl.DateTimeFormat to get Central Time components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(utcDate);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hours = parts.find(p => p.type === 'hour').value;
    const minutes = parts.find(p => p.type === 'minute').value;

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.warn('Error converting UTC to Central Time:', utcString, error);
    return '';
  }
};

// Convert Central Time datetime-local format to UTC ISO string
export const centralToUTC = (centralDateTime) => {
  if (!centralDateTime) return null;
  try {
    // Parse the datetime-local string (YYYY-MM-DDTHH:mm)
    const [datePart, timePart] = centralDateTime.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);

    // Create a date string in ISO format for the Central Time moment
    // We'll create a UTC date and then adjust it to represent Central Time
    // Method: Create a test date at the target Central Time, format it in both timezones to get offset

    // Create a reference date at the target Central Time
    // Use a known UTC time and see what Central Time it represents, then work backwards
    const testUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // Noon UTC on target date
    const testCentral = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(testUTC);

    const testCentralHour = parseInt(testCentral.find(p => p.type === 'hour').value);
    const testUTCHour = 12; // We set it to noon UTC

    // Calculate offset: if Central Time shows 6 AM when UTC is noon, offset is -6 hours
    const offsetHours = testCentralHour - testUTCHour;
    if (testCentralHour < testUTCHour) {
      // Central Time is behind UTC (e.g., 6 AM CT = 12 PM UTC means -6 hours)
      // But we need to check if it's the same day
      const testCentralDay = parseInt(testCentral.find(p => p.type === 'day').value);
      if (testCentralDay < day) {
        // Central Time day is behind, so offset is more negative
        // Actually, let's use a simpler approach
      }
    }

    // Simpler: Create UTC date for Central Time midnight, then add hours/minutes
    // Central Time midnight on the target date = UTC (day, 6:00) or (day-1, 5:00) depending on DST
    // Calculate offset dynamically by checking what UTC time corresponds to Central Time midnight
    const centralMidnightUTC = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`);
    const centralMidnightFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      hour: '2-digit',
      hour12: false
    }).format(centralMidnightUTC);

    // Actually, much simpler: use the reverse of toCentralDateTime
    // If we have Central Time components, create a UTC date that when formatted in Central Time gives us those components
    // We can iterate or use a known formula

    // Most reliable: Create date at target Central Time, get its UTC equivalent
    // Use Date constructor with timezone offset
    // For December (CST), offset is UTC-6, so Central Time = UTC + 6 hours
    // But DST makes this variable, so calculate dynamically

    // Create a date representing Central Time, then get UTC
    // Method: Create UTC date, format in Central Time, adjust until it matches
    let utcCandidate = new Date(Date.UTC(year, month - 1, day, hours + 6, minutes, 0)); // Assume UTC-6 (CST)

    // Verify and adjust if needed
    const verifyCentral = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(utcCandidate);

    const verifyYear = parseInt(verifyCentral.find(p => p.type === 'year').value);
    const verifyMonth = parseInt(verifyCentral.find(p => p.type === 'month').value);
    const verifyDay = parseInt(verifyCentral.find(p => p.type === 'day').value);
    const verifyHour = parseInt(verifyCentral.find(p => p.type === 'hour').value);
    const verifyMinute = parseInt(verifyCentral.find(p => p.type === 'minute').value);

    // Adjust if needed (should be close, might need ±1 hour for DST)
    if (verifyYear !== year || verifyMonth !== month || verifyDay !== day || verifyHour !== hours || verifyMinute !== minutes) {
      // Try with 5 hours offset (CDT, UTC-5)
      utcCandidate = new Date(Date.UTC(year, month - 1, day, hours + 5, minutes, 0));
      const verify2 = new Intl.DateTimeFormat('en-US', {
        timeZone: CENTRAL_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(utcCandidate);

      const v2Year = parseInt(verify2.find(p => p.type === 'year').value);
      const v2Month = parseInt(verify2.find(p => p.type === 'month').value);
      const v2Day = parseInt(verify2.find(p => p.type === 'day').value);
      const v2Hour = parseInt(verify2.find(p => p.type === 'hour').value);
      const v2Minute = parseInt(verify2.find(p => p.type === 'minute').value);

      if (v2Year === year && v2Month === month && v2Day === day && v2Hour === hours && v2Minute === minutes) {
        return utcCandidate.toISOString();
      }
    } else {
      return utcCandidate.toISOString();
    }

    // If neither worked, return the 6-hour offset version (most common for winter)
    return utcCandidate.toISOString();
  } catch (error) {
    console.warn('Error converting Central Time to UTC:', centralDateTime, error);
    // Fallback: assume UTC-6 (CST) - add 6 hours
    try {
      const [datePart, timePart] = centralDateTime.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      const fallbackDate = new Date(Date.UTC(year, month - 1, day, hours + 6, minutes, 0));
      return fallbackDate.toISOString();
    } catch {
      return null;
    }
  }
};
