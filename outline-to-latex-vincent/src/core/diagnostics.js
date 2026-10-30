// Everything a build wants to tell the user. `note` is a vault-relative path
// when known, so the plugin can open the note that caused the message.
class Diagnostics {
	constructor() {
		this.items = [];
	}

	error(message, note) {
		this.items.push({ level: 'error', message, note });
	}

	warn(message, note) {
		this.items.push({ level: 'warning', message, note });
	}

	get hasErrors() {
		return this.items.some((item) => item.level === 'error');
	}
}

module.exports = { Diagnostics };
