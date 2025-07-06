// Centralized date utilities to handle timezone issues consistently

export function formatDateTimeLocal(dateString: string): string {
  if (!dateString) return '';
  
  // Create date object and format for datetime-local input
  const date = new Date(dateString);
  return date.toISOString().slice(0, 16);
}

export function formatDisplayDateTime(dateString: string): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function formatDisplayDateTimeFull(dateString: string): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return '';
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startStr = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  
  const endStr = end.toLocaleDateString('en-US', {
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
  
  return `${startStr} - ${endStr}`;
}

export function createDateTimeFromInputs(date: string, time: string): string {
  if (!date || !time) return '';
  
  // Create a local date object and convert to ISO string
  const dateTime = new Date(`${date}T${time}`);
  return dateTime.toISOString();
}

export function splitDateTime(dateTimeString: string): { date: string; time: string } {
  if (!dateTimeString) return { date: '', time: '' };
  
  const date = new Date(dateTimeString);
  
  // Get local date and time components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`
  };
}