function format(
	params: Partial<{
		days: number;
		hours: number;
		minutes: number;
		seconds: number;
	}>,
) {
	const { days, hours, minutes, seconds } = params;
	const time = [];
	if (days) {
		time.push(`${days} day${days > 1 ? 's' : ''}`);
	}
	if (hours) {
		time.push(`${hours} hour${hours > 1 ? 's' : ''}`);
	}
	if (minutes) {
		time.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
	}

	if (seconds) {
		time.push(`${seconds.toFixed(0)} seconds`);
	}
	return time.join(' ');
}

export default function formatTime(time?: number, hours?: number): string {
	if (!time) return '--';
	let minutes;
	let seconds;
	if (time > 60) {
		minutes = Math.floor(time / 60);

		seconds = time - minutes * 60;
	}

	if (minutes && minutes > 60) {
		hours = Math.floor(time / 3600);
		return formatTime(time - hours * 3600, hours);
	}

	if (hours && hours > 24) {
		const days = Math.floor(hours / 24);
		return format({ days, hours: hours - days * 24, minutes, seconds });
	}

	if (hours) {
		return format({ hours, minutes, seconds });
	}

	if (minutes) {
		return format({ minutes, seconds });
	}

	return format({ seconds });
}
