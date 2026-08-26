/**
 * Модуль по работе с масками телефонов
 */
class PhoneMaskManager {
	constructor() {
		this.masks = {
			// Российские номера
			ru_mobile_7: {
				pattern: "+7(###)###-##-##",
				regex: /^\+?7\d{10}$/,
				countryCode: "7",
				maxLength: 11,
			},
			ru_mobile_8: {
				pattern: "8(###)###-##-##",
				regex: /^8\d{10}$/,
				countryCode: "8",
				maxLength: 11,
			},
			// Американские номера
			us_phone: {
				pattern: "+1(###)###-####",
				regex: /^\+?1\d{10}$/,
				countryCode: "1",
				maxLength: 11,
			},
			// Немецкие номера
			de_phone: {
				pattern: "+49(###)####-####",
				regex: /^\+?49\d{10,11}$/,
				countryCode: "49",
				maxLength: 13,
			},
			// Украинские номера
			ua_phone: {
				pattern: "+380(##)###-##-##",
				regex: /^\+?380\d{9}$/,
				countryCode: "380",
				maxLength: 12,
			},
		};

		this.observers = [];
		this.currentMask = null;
		this.activeInputs = new Set();
	}

	// Метод для добавления новой маски
	addMask(key, maskConfig) {
		this.masks[key] = maskConfig;
	}

	// Определение подходящей маски по номеру
	detectMask(phone) {
		const digits = this.getDigitsOnly(phone);

		if (digits.startsWith("7")) {
			return this.masks.ru_mobile_7;
		}
		if (digits.startsWith("8")) {
			return this.masks.ru_mobile_8;
		}
		if (digits.startsWith("1")) {
			return this.masks.us_phone;
		}
		if (digits.startsWith("49")) {
			return this.masks.de_phone;
		}
		if (digits.startsWith("380")) {
			return this.masks.ua_phone;
		}

		// Если не найдена подходящая маска, используем базовую международную
		return {
			pattern: "+###############",
			regex: /^\+?\d{7,15}$/,
			countryCode: "",
			maxLength: 15,
		};
	}

	// Основной метод форматирования телефона
	formatPhone(phone, update = true) {
		if (!phone) return "";

		const digits = this.getDigitsOnly(phone);
		if (!digits) return "";

		const mask = this.detectMask(digits);
		if (update) this.currentMask = mask;

		let formatted = "";

		// Специальная обработка для российских номеров
		if (mask === this.masks.ru_mobile_7) {
			formatted = this.formatRussianMobile7(digits);
		} else if (mask === this.masks.ru_mobile_8) {
			formatted = this.formatRussianMobile8(digits);
		} else if (mask === this.masks.us_phone) {
			formatted = this.formatUSPhone(digits);
		} else if (mask === this.masks.de_phone) {
			formatted = this.formatGermanPhone(digits);
		} else if (mask === this.masks.ua_phone) {
			formatted = this.formatUkrainianPhone(digits);
		} else {
			// Общее форматирование для других стран
			formatted = "+" + digits;
		}

		// Уведомляем наблюдателей
		if (update) {
			const isValid = this.validatePhone(formatted);
			this.notifyObservers(formatted, digits, isValid);
		}

		return formatted;
	}

	// Форматирование российских номеров (+7)
	formatRussianMobile7(digits) {
		let formatted = "+7";

		if (digits.length > 1) {
			const rest = digits.substring(1);
			formatted += "(" + rest.substring(0, Math.min(3, rest.length));

			if (rest.length > 3) {
				formatted += ")" + rest.substring(3, 6);

				if (rest.length > 6) {
					formatted += "-" + rest.substring(6, 8);

					if (rest.length > 8) {
						formatted += "-" + rest.substring(8, 10);
					}
				}
			}
		}

		return formatted;
	}

	// Форматирование российских номеров (8)
	formatRussianMobile8(digits) {
		let formatted = "8";

		if (digits.length > 1) {
			const rest = digits.substring(1);
			formatted += "(" + rest.substring(0, Math.min(3, rest.length));

			if (rest.length > 3) {
				formatted += ")" + rest.substring(3, 6);

				if (rest.length > 6) {
					formatted += "-" + rest.substring(6, 8);

					if (rest.length > 8) {
						formatted += "-" + rest.substring(8, 10);
					}
				}
			}
		}

		return formatted;
	}

	// Форматирование американских номеров
	formatUSPhone(digits) {
		let formatted = "+1";

		if (digits.length > 1) {
			const rest = digits.substring(1);
			formatted += "(" + rest.substring(0, Math.min(3, rest.length));

			if (rest.length > 3) {
				formatted += ")" + rest.substring(3, 6);

				if (rest.length > 6) {
					formatted += "-" + rest.substring(6, 10);
				}
			}
		}

		return formatted;
	}

	// Форматирование немецких номеров
	formatGermanPhone(digits) {
		let formatted = "+49";

		if (digits.length > 2) {
			const rest = digits.substring(2);
			formatted += "(" + rest.substring(0, Math.min(3, rest.length));

			if (rest.length > 3) {
				formatted += ")" + rest.substring(3, 7);

				if (rest.length > 7) {
					formatted += "-" + rest.substring(7, 11);
				}
			}
		}

		return formatted;
	}

	// Форматирование украинских номеров
	formatUkrainianPhone(digits) {
		let formatted = "+380";

		if (digits.length > 3) {
			const rest = digits.substring(3);
			formatted += "(" + rest.substring(0, Math.min(2, rest.length));

			if (rest.length > 2) {
				formatted += ")" + rest.substring(2, 5);

				if (rest.length > 5) {
					formatted += "-" + rest.substring(5, 7);

					if (rest.length > 7) {
						formatted += "-" + rest.substring(7, 9);
					}
				}
			}
		}

		return formatted;
	}

	// Метод проверки корректности телефона
	validatePhone(phone) {
		if (!phone) return false;

		const digits = this.getDigitsOnly(phone);
		const mask = this.detectMask(digits);

		return mask.regex.test("+" + digits) || mask.regex.test(digits);
	}

	// Метод получения номера без форматирования
	getUnformattedPhone(formattedPhone) {
		if (!formattedPhone) return "";
		return this.getDigitsOnly(formattedPhone);
	}

	// Получение только цифр из строки
	getDigitsOnly(str) {
		return str.replace(/\D/g, "");
	}

	// Инициализация масок для input полей
	initializeInputMasks(selector) {
		const inputs = document.querySelectorAll(selector);

		inputs.forEach((input) => {
			if (this.activeInputs.has(input)) return;

			this.activeInputs.add(input);

			// Форматируем существующее значение
			if (input.value) {
				input.value = this.formatPhone(input.value);
			}

			// Добавляем обработчик событий
			input.addEventListener("input", (e) => {
				const digits = this.getDigitsOnly(e.target.value);
				const mask = this.detectMask(digits);

				if (digits.length > mask.maxLength) {
					const trimmedDigits = digits.substring(0, mask.maxLength);
					e.target.value = this.formatPhone(trimmedDigits);
				} else {
					e.target.value = this.formatPhone(digits);
				}
			});

			input.addEventListener("paste", (e) => {
				setTimeout(() => {
					const digits = this.getDigitsOnly(e.target.value);
					const mask = this.detectMask(digits);
					if (digits.length > mask.maxLength) {
						e.target.value = this.formatPhone(
							digits.substring(0, mask.maxLength),
						);
					} else {
						e.target.value = this.formatPhone(digits);
					}
				}, 0);
			});

			input.addEventListener("keydown", (e) => {
				// Разрешаем только цифры, backspace, delete, стрелки, tab
				const allowedKeys = [
					"Backspace",
					"Delete",
					"Tab",
					"Escape",
					"Enter",
					"ArrowLeft",
					"ArrowRight",
					"ArrowUp",
					"ArrowDown",
				];

				if (
					!allowedKeys.includes(e.key) &&
					!e.ctrlKey &&
					!e.metaKey &&
					!/\d/.test(e.key)
				) {
					e.preventDefault();
				}
			});
		});
	}

	// Корректировка позиции курсора после форматирования
	setCursorPosition(input, cursorPosition, oldValue, newValue) {
		const oldDigits = this.getDigitsOnly(oldValue.substring(0, cursorPosition));
		let newPosition = 0;
		let digitCount = 0;

		for (let i = 0; i < newValue.length; i++) {
			if (/\d/.test(newValue[i])) {
				digitCount++;
				if (digitCount > oldDigits.length) {
					break;
				}
			}
			newPosition = i + 1;
		}

		setTimeout(() => {
			input.setSelectionRange(newPosition, newPosition);
		}, 0);
	}

	// Добавление наблюдателя
	addObserver(observer) {
		this.observers.push(observer);
	}

	// Удаление наблюдателя
	removeObserver(observer) {
		this.observers = this.observers.filter((obs) => obs !== observer);
	}

	// Уведомление наблюдателей
	notifyObservers(formattedPhone, rawPhone, isValid) {
		this.observers.forEach((observer) => {
			if (typeof observer === "function") {
				observer(formattedPhone, rawPhone, isValid);
			} else if (observer.onPhoneChange) {
				observer.onPhoneChange(formattedPhone, rawPhone, isValid);
			}
		});
	}

	// Получение информации о текущей маске
	getCurrentMaskInfo() {
		return this.currentMask;
	}

	// Получение всех доступных масок
	getAvailableMasks() {
		return Object.keys(this.masks);
	}

	// Очистка всех активных input полей
	clearActiveInputs() {
		this.activeInputs.clear();
	}
};