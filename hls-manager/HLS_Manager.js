/**
 * Видео в карточке товара
 * Поддержка HLS (протокола  потоковой передачи данных), MP4
 */
document.addEventListener("DOMContentLoaded", function () {
	const $product = $widget;
	const VIDEO_TIMEOUT = 1500000; // Таймаут для загрузки видео

	const utils = {
		debounce(func, wait) {
			let timeout;
			return function (...args) {
				const context = this;
				clearTimeout(timeout);
				timeout = setTimeout(() => func.apply(context, args), wait);
			};
		},

		// Promise с таймаутом
		withTimeout(promise, ms) {
			return Promise.race([
				promise,
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Timeout")), ms),
				),
			]);
		},

		// Безопасная очистка видео элемента
		cleanupVideo(video) {
			try {
				if (video) {
					// Паузим видео
					if (!video.paused) {
						video.pause();
					}

					// Очищаем src для предотвращения утечек памяти
					video.removeAttribute("src");
					video.load(); // Принудительная очистка буфера
					// Удаляем все source элементы
					const sources = video.querySelectorAll("source");
					sources.forEach((source) => {
						source.removeAttribute("src");
						source.remove();
					});
				}
			} catch (error) {
				console.warn("[VIDEO] Cleanup error:", error);
			}
		},

		// Проверка мобильного устройства
		isMobile() {
			return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
				navigator.userAgent,
			);
		},

		// Проверка iOS
		isIOS() {
			return /iPad|iPhone|iPod/.test(navigator.userAgent);
		},
	};

	/**
     * Класс для управления HLS
     */
	class HLSManager {
		constructor(video) {
			this.video = video;
			this.hls = null;
			this.loadTimeout = null;
		}

		// Загрузка HLS с таймаутом
		async loadHLS(hlsUrl) {
			if (typeof Hls === "undefined" || !Hls.isSupported()) {
				throw new Error("HLS not supported");
			}

			return new Promise((resolve, reject) => {
				this.hls = new Hls({
					startLevel: -1,
					capLevelToPlayerSize: true,
					maxLoadingDelay: 1, // Быстрый старт
					maxBufferLength: 10,
					lowLatencyMode: true,
					// Оптимизированные настройки для быстрой загрузки
					maxMaxBufferLength: 20,
					maxBufferSize: 30 * 1000 * 1000, // 60MB
					maxBufferHole: 0.5,
				});

				// Обработка ошибок HLS
				this.hls.on(Hls.Events.ERROR, (_, data) => {
					console.warn("[VIDEO] HLS error:", data);
					if (data.fatal) {
						switch (data.type) {
							case Hls.ErrorTypes.NETWORK_ERROR:
								if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
									reject(new Error("Manifest load failed"));
								} else {
									// Попытка восстановления для сетевых ошибок
									this.hls.startLoad();
								}
								break;
							case Hls.ErrorTypes.MEDIA_ERROR:
								this.hls.recoverMediaError();
								break;
							default:
								reject(new Error("Fatal HLS error: " + data.details));
								break;
						}
					}
				});

				// Успешная загрузка манифеста
				this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
					clearTimeout(this.loadTimeout);
					resolve();
				});

				// Установка таймаута
				this.loadTimeout = setTimeout(() => {
					reject(new Error("HLS load timeout"));
				}, VIDEO_TIMEOUT);

				try {
					this.hls.loadSource(hlsUrl);
					this.hls.attachMedia(this.video);
				} catch (error) {
					clearTimeout(this.loadTimeout);
					reject(error);
				}
			});
		}

		// Очистка HLS ресурсов
		destroy() {
			if (this.loadTimeout) {
				clearTimeout(this.loadTimeout);
				this.loadTimeout = null;
			}
			if (this.hls) {
				this.hls.destroy();
				this.hls = null;
			}
		}
	}

	// Основная функция загрузки видео
	async function LoadVideo(video, controls = false) {
		const scr = video.getAttribute("data-em-video");
		if (!scr) {
			console.warn("[VIDEO] No data-em-video attribute found");
			return;
		}
		var loaderVideo;
		const hlsUrl = `${scr}.m3u8`;
		const mp4Url = `${scr}.mp4`;
		const video_i = video.getAttribute("data-video-i") ?? 0;

		var hlsManager = null;
		var loadSuccess = false;

		const loadMP4 = () => {
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("MP4 load timeout"));
				}, VIDEO_TIMEOUT);

				const onCanPlay = () => {
					clearTimeout(timeout);
					video.removeEventListener("canplay", onCanPlay);
					video.removeEventListener("error", onError);
					resolve();
				};

				const onError = (error) => {
					clearTimeout(timeout);
					video.removeEventListener("canplay", onCanPlay);
					video.removeEventListener("error", onError);
					reject(new Error("MP4 load error: " + error.message));
				};

				video.addEventListener("canplay", onCanPlay, { once: true });
				video.addEventListener("error", onError, { once: true });
				video.src = mp4Url;
			});
		};

		if (!controls) {
			video.loop = true;
			video.volume = 0;
			loaderVideo = new EM_Module.Loader($(video.parentElement));
			loaderVideo.call();
		}
		try {
			// Проверка нативной поддержки HLS (Safari)
			if (video.canPlayType("application/vnd.apple.mpegurl")) {
				console.log("[VIDEO] Using native HLS support");
				await utils.withTimeout(
					new Promise((resolve, reject) => {
						const onCanPlay = () => {
							video.removeEventListener("canplay", onCanPlay);
							video.removeEventListener("error", onError);
							resolve();
						};

						const onError = (error) => {
							video.removeEventListener("canplay", onCanPlay);
							video.removeEventListener("error", onError);
							reject(error);
						};

						video.addEventListener("canplay", onCanPlay, { once: true });
						video.addEventListener("error", onError, { once: true });
						video.src = hlsUrl;
					}),
					VIDEO_TIMEOUT,
				);
				loadSuccess = true;
			}
			// HLS поддержка
			else if (typeof Hls !== "undefined" && Hls.isSupported()) {
				console.log("[VIDEO] Using HLS.js");
				hlsManager = new HLSManager(video);
				await hlsManager.loadHLS(hlsUrl);

				loadSuccess = true;
			}
			// Fallback на MP4
			else {
				console.log("[VIDEO] No HLS support, using MP4");
				await loadMP4();

				loadSuccess = true;
			}
		} catch (error) {
			console.warn(
				"[VIDEO] Primary load failed, trying MP4 fallback:",
				error.message,
			);

			// Очистка предыдущих попыток
			if (hlsManager) {
				hlsManager.destroy();
				hlsManager = null;
			}

			try {
				await loadMP4();
				loadSuccess = true;
				console.log("[VIDEO] MP4 fallback successful");
			} catch (mp4Error) {
				console.error("[VIDEO] All loading attempts failed:", mp4Error.message);
				if (loaderVideo) loaderVideo.hide();

				// Выходим, если ничего не получилось
				return;
			}
		}

		if (!loadSuccess) {
			if (loaderVideo) loaderVideo.hide();
			return;
		}

		// Настройка основных свойств видео
		video.controls = controls;

		if (!controls) {
			// Принудительная попытка воспроизведения с обработкой ошибок
			setTimeout(async () => {
				try {
					console.log("[VIDEO] Autoplay successful");
					if (video.nextElementSibling) {
						video.nextElementSibling.setAttribute("hidden", true);
					}
					loaderVideo.hide();
					try {
						await video.play();
					} catch (err) {
						console.warn("Autoplay blocked:", err);
					}

					// $product.find(".product-card-info__title:first").append('[VIDEO] Autoplay successful');
				} catch (error) {
					// $product.find(".product-card-info__title:first").append('[VIDEO] Autoplay failed, will try on user interaction: ' + error.message);
					console.warn(
						"[VIDEO] Autoplay failed, will try on user interaction:",
						error.message,
					);

					// Добавляем обработчик для первого взаимодействия пользователя
					const playOnInteraction = () => {
						video
							.play()
							.catch((e) =>
								console.warn("[VIDEO] Play on interaction failed:", e),
							);
						document.removeEventListener("click", playOnInteraction);
						document.removeEventListener("touchstart", playOnInteraction);
					};

					document.addEventListener("click", playOnInteraction, { once: true });
					document.addEventListener("touchstart", playOnInteraction, {
						once: true,
					});
				}
			}, 650);
		}

		// Настройка обработчиков событий
		setupVideoHandlers(video, video_i, controls, hlsManager);
	}

	// Функция настройки обработчиков событий
	function setupVideoHandlers(video, video_i, controls, hlsManager) {
		var isPaused = false;
		// let observer = null;

		// Обработчики для видео в карточке товара
		if (!controls) {
			const videoPopup = $product
				.find(`.popup-gallery video[data-video-i="${video_i}"]:first`)
				.get(0);

			// Клик по видео в карточке
			const handleCardVideoClick = () => {
				if (!video.paused) {
					video.pause();
				}

				if (videoPopup) {
					videoPopup.currentTime = video.currentTime;
					videoPopup.muted = false;
					if (videoPopup.paused) {
						videoPopup.play().catch((error) => {
							console.warn("[VIDEO] Popup video play failed:", error);
						});
					}
				}
			};

			// Добавляем обработчики событий для мобильных и десктопных устройств
			video.addEventListener("click", handleCardVideoClick);

			const observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.intersectionRatio < 0.4 && !video.paused) {
							video.pause();
							isPaused = true;
						} else if (isPaused && entry.intersectionRatio >= 0.4) {
							video.play().catch((error) => {
								console.warn("[VIDEO] Auto-play failed:", error);
							});
							isPaused = false;
						}
					});
				},
				{ threshold: 0.4 },
			);
			observer.observe(video);
		}
		// Обработчики для видео в попапе
		else {
			const videoProduct = $product
				.find(`.product-card video[data-video-i="${video_i}"]:first`)
				.get(0);

			const handlePopupVideoClick = (e) => {
				console.log("[VIDEO] Popup video clicked/touched");

				// Останавливаем всплытие события для предотвращения конфликтов
				e.preventDefault();
				e.stopPropagation();

				if (!video.paused) {
					video.muted = true;
					setTimeout(() => {
						video.pause();
					}, 150);
				}

				if (videoProduct) {
					videoProduct.currentTime = video.currentTime;
					if (videoProduct.paused) {
						setTimeout(() => {
							videoProduct.play().catch((error) => {
								console.warn("[VIDEO] Product video play failed:", error);
							});
						}, 150);
					}
				}

				// Закрытие попапа
				const popupBody = e.target.closest(".popup__body");
				if (popupBody) {
					setTimeout(() => {
						popupBody.click();
					}, 150);
				}
			};

			// Добавляем обработчики для всех типов устройств
			video.addEventListener("click", handlePopupVideoClick);
			video.addEventListener("touchstart", handlePopupVideoClick);

			document.addEventListener("afterPopupClose", function (e) {
				if (!e.detail.popup.hash === "#popup-gallery") return;
				if (!video.paused) {
					video.muted = true;
					setTimeout(() => {
						video.pause();
					}, 150);
				}
				if (videoProduct) {
					videoProduct.currentTime = video.currentTime;
					if (videoProduct.paused) {
						setTimeout(() => {
							videoProduct.play().catch((error) => {
								console.warn("[VIDEO] Product video play failed:", error);
							});
						}, 150);
					}
				}
			});
		}

		// Логирование событий (можно убрать в продакшене)
		/*
        video.addEventListener('play', () => {
            console.log("[VIDEO]", video.classList, "play");
            // $product.find(".product-card-info__price:first").append("<div>[VIDEO] " +  video.classList + " play</div>");
        }, DEBOUNCE_DELAY);

        video.addEventListener('pause', () => {
            console.log("[VIDEO]", video.classList, "pause");
        }, DEBOUNCE_DELAY);
        */
	}

	// Инициализация всех видео на странице
	const initializeAllVideos = () => {
		const videos = $product.find("[data-em-video]");
		console.log(`[VIDEO] Initializing ${videos.length} videos`);

		videos.each((_, video) => {
			const hasControls =
				video.getAttribute("data-em-video-controls") === "true";
			LoadVideo(video, hasControls);
		});
	};

	// Запуск инициализации
	EventBus.subscribe("eventLoader", initializeAllVideos);
});
