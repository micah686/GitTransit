export const errorMessages = {
	AUTH_INVALID: 'Email or password is incorrect.',
	AUTH_THROTTLED: 'Too many sign-in attempts. Try again later.',
	SETUP_CLOSED: 'Initial setup is already complete.',
	VALIDATION_FAILED: 'Review the highlighted fields and try again.',
	INTERNAL_ERROR: 'Something went wrong. Try again or contact your administrator.'
} as const;

export type ErrorCode = keyof typeof errorMessages;
