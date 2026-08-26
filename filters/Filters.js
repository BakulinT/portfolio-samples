/**
 * Filters JS 
 * Модуль фильтров на бизе InSales
 * Версия: 1.0.0
 */
class Filters {
	constructor(params = {}) {
		this._name = "[EM.Filters]";
		this._inited = false; // Инициализация
		this._availableLocalStorage = true; // Провекра работы LocalStorage 

		this.typePage = window.location.pathname.includes("/favorites") ? "wishlist" : "search";

		this.nameEvent = "em_filter:update";
		this.nameKeyCached = "em_cached_filter:" + this.typePage;

		this.$filtres = $("#filters");                  // Общий блок фильтров, включая ПК
		this.$filtresMob = null;                        // Мобильный блок фильтров
		this.$filtresMobColor = null; // Мобильный блок фильтров цветов
		this.$panelSelectFilters = this.$filtres.find(".selected-filters:first"); // Панель выбранных фильтров

		this.$btnMore = $("[data-load-more]:first");    // Кнопка "Загрузить еще"
		this.$btnMobApply = null; // Кнопка применения моб фильтров
		this.$btnReset = null; // Кнопка сброса фильтров без применения
		this.$btnResetColor = null; // Кнопка сброса фильтров без применения
		this.$btnMobCounter = null;

		this.filters = {}; // Хранение параметров фильтров

		this.currentPage = params.currentPage ?? 1;
		this.pageSize = params.pageSize ?? 16;
		this.clientID = null;

		// Режим каталога: использовать фильтры из Liquid, не запрашивать API
		this.modeCatalog = params.mode === "catalog" || params.skipFetch === true;
		this.typeFiltersFetch = params.favorites === "favorites"

		// Примененные фильтры
		this.applied = {
			quantity: 0,
			quantityColor: 0,
			change: false,
			sort: false
		};

		// ID фильтров
		this.filtersID = {
			color: 1607435
		};

		// События у фильтров
		this.typesEvent = {
			init: 	"init",     // Инициализация фильтров
			change: "change",   // Изменение фильтров
			render: "render",   // Отрисовка фильтров
			remove: "remove",   // Удаление фильтров
			clear: 	"clear"     // Очистка
		};

		// Список доступных шаблонов
		this.templates = {
			filterSelected: "filter-selected",              // Шаблон выбранного фильтра
			filterSelectedPrice: "filter-selected-price",   // Шаблон выбранного фильтра цены

			// ПК шаблоны
			filterItem: "filter-item",                      // Шаблон фильтра
			filterItemPrice: "filter-price",                // Шаблон фильтра цен

			// Мобильные шаблоны
			filterMobItem: "filter-item-mob",               // Шаблон фильтра
			filterMobColor: "filter-color-mob",             // Шаблон фильтра цветов
			filterPopupMobColor: "filter-popup-color-mob",  // Шаблон попапа фильтра цветов
			filterMobItemPrice: "filter-price-mob"          // Шиблон фильтра цен
		};

		this.TTL_MS = 60 * 60 * 1000; // 1 час
	}

	async init() {
		this.isMobile = sessionStorage.getItem("isMobile") === "true"; // Проверка типа устрйства
		this.isMobStyle = window.matchMedia("(max-width: 63.9988em)").matches; // Провекра размера экрана

		if (this.isMobStyle) {
			this.$filtresMob = $("[data-mob-popup='filters']:first");
			this.$filtresMobColor = $("[data-mob-popup='filter-colors']:first");

			this.$btnMobApply = this.$filtresMob.find("[data-mob-apply]:first");
			this.$btnReset = this.$filtresMob.find("[data-mob-btn-clear='filters']:first");
			this.$btnMobCounter = this.$filtres.find("[data-mob-popup-open]:first .icon-counter");

			this.$btnResetColor = this.$filtresMobColor.find("[data-mob-btn-clear='filter-colors']:first");
		}

		this.readingFilters();
		this.initEvent();
	}

	initEvent() {
		/*** Общие слушатели ***/
		document.addEventListener("click", this.click.bind(this));
		document.addEventListener("change", this.change.bind(this));

		/*** Мобильные слушатели ***/
		if (this.isMobStyle) {
			this.$filtresMob.on("click", this.clickMob.bind(this));
			this.$filtresMob.on("change", this.changeMob.bind(this));

			// Сброс выбранных цветов в попапе фильтров
			this.$filtresMobColor.on("click", "[data-mob-btn-clear='filter-colors']", () => this.clearColorMobFilters(false));
		}

		/*** ПК слушатели ***/
		else {
			// Выбор сортировки (кастомный селект или нативный)
			const $customSort = this.$filtres.find(".select_catalog-sort:first");
			if ($customSort.length) {
				$customSort.on("click", ".select__option", this.changeSort.bind(this));
			} else {
				this.$filtres.find(".catalog__sort:first").on("change", this.changeSort.bind(this));
			}

			// Применение фильтров
			document.addEventListener("click", (e) => {
				if (
					this.applied.change && 
					!e.target.closest(".filters__body") && !e.target.closest(".filters__title-wrapper")
				) {
					this.applyPCiltres();
				}
			});
		}
	}

	// Общий слушатель
	click(e) {
		// Очистка фильтров
		if (e.target.hasAttribute("data-clear-filtres")) {
			this.clearFilters();
		}
		// Удаление фильтра
		else if (e.target.hasAttribute("data-remove-filter")) {
			this.removeFilter(e.target.closest(".selected-filters__item"));
		}
	}

	// Мобильный слушатель
	clickMob(e) {
		// Применение выбранных фильтров
		if (e.target.hasAttribute("data-mob-apply")) {
			this.applyMobFiltres();
		}

		// Сброс выбранных фильтров
		else if (e.target.getAttribute("data-mob-btn-clear") === "filters") {
			this.clearFilters(false);
		}

		// Кнопка "Загрузить еще"
		else if (e.target.hasAttribute("data-load-more")) {
			this.nextPages();
		}
	}

	// Общий слушатель
	change(e) {
		// Изменение состояние фильтра цены
		if (e.target.classList.contains("price-filter__input")) {
			this.changePriceFilter(e.target);
		}

		// Изменение состояние фильтра
		else if (
			e.target.classList.contains("checkbox__input") ||
			e.target.classList.contains("checkbox-btn__input")
		) {
			this.changeFilter(e.target);
		}
	}

	// Мобильный слушатель
	changeMob(e) {
		// Выбор сортировки
		if (e.target.name == "filters-sort") {
			this.changeSort(e);
		}
	}

	// Изменение состояние фильтра
	changeFilter(input) {
		const isMobFilter = input.classList.contains("checkbox-btn__input") || input.dataset.index !== undefined;
		const filterID = input.getAttribute("data-property-id");
		const filterItemID = input.value;

		if (!filterID || !filterItemID) return;

		const img = input.parentElement.querySelector("img");
		const title = input.parentElement.querySelector(
			isMobFilter ? ".checkbox-btn__text" : ".checkbox__text"
		);

		// Передача состояния между попапом цветов и селектом (мобилка)
		if (
			isMobFilter &&
			input.dataset.index !== undefined && Number(input.dataset.index) < 8
		) {
			this.$filtresMob.find(`.checkbox-btn__input[value="${filterItemID}"]`).attr("checked", input.checked);
		}
		else if (
			isMobFilter &&
			filterID === String(this.filtersID.color)
		) {
			this.$filtresMobColor.find(`.checkbox__input[value="${filterItemID}"]`).attr("checked", input.checked);
		}

		if (filterID === String(this.filtersID.color)) {
			this.applied.quantityColor += input.checked ? 1 : -1;
		}
		else {
			this.applied.quantity += input.checked ? 1 : -1;
		}
		this.visibleBtnsFilters(true);

		if (input.checked) {
			this.addFilter({
				id: filterID,
				itemID: filterItemID,
				title: title?.innerText ?? "Фильтр",
				img: img?.src
			}, false);
		}
		else {
			this.removeFilter(
				this.$panelSelectFilters.find(`[data-selected-filter-id="${filterItemID}"]:first`).get(0)
			);
		}
	}

	// Изменение сортировки
	changeSort(e) {
		let typeSort;
		if (e.target.localName === "input") {
			typeSort = e.target.value;
		} else if (e.target.localName === "select") {
			typeSort = e.target.value;
		} else {
			typeSort = e.target.dataset?.value;
		}

		if (!typeSort) return;
		if (e.target.localName !== "input" && e.target.localName !== "select") {
			$(e.target.parentElement).find("._active").removeClass("_active");
			e.target.classList.add("_active");
		}
		this.applied.sort = true;
		this.visibleBtnsFilters(true);


		if (!this.isMobStyle) {
			this.currentPage = 1;
			this.applied.change = false;

			EventBus.publish(this.nameEvent, {
				added: {
					id: "sort",
					type: this.getNameSort(typeSort)
				},
				method: this.typesEvent.change,
				filters: this.filters
			});
		}
	}
	// Изменение цены
	changePriceFilter(input) {
		const wrapper = input.closest(".price-filter__inputs");

		const inputPriceMin = wrapper.querySelector("input[name='price_min']");
		const inputPriceMax = wrapper.querySelector("input[name='price_max']");

		if (!inputPriceMin || !inputPriceMax) return;

		const priceMin = Number(inputPriceMin.getAttribute("data-range-from"));
		const priceMax = Number(inputPriceMax.getAttribute("data-range-to"));
		const selectPriceMin = Number(inputPriceMin.value);
		const selectPriceMax = Number(inputPriceMax.value);

		if (isNaN(priceMin) || isNaN(priceMax) || isNaN(selectPriceMin) || isNaN(selectPriceMax)) {
			this.removeFilter(
				this.$panelSelectFilters.find("[data-filter-id='price']:first").get(0)
			);
			return;
		}

		if (selectPriceMin > priceMin || selectPriceMax < priceMax) {
			this.applied.quantity++;
			this.addFilterPrice({
				id: "price",
				priceMin: Math.max(priceMin, selectPriceMin),
				priceMax: Math.min(priceMax, selectPriceMax),
			}, false);
		}
		else {
			this.applied.quantity--;
			this.removeFilter(
				this.$panelSelectFilters.find("[data-filter-id='price']:first").get(0)
			);
		}
		this.visibleBtnsFilters(true);
	}

	// Применение Фильтров на ПК
	applyPCiltres() {
		this.applied.change = false;
		EventBus.publish(this.nameEvent, {
			method: this.typesEvent.change,
			filters: this.filters
		});
	}

	// Применение Фильтров на мобильной устройстве
	applyMobFiltres() {
		if (this.applied.change) {
			this.applied.change = false;
			this.$filtresMob.find("[data-mob-popup-close]:first").trigger("click");

			EventBus.publish(this.nameEvent, {
				method: this.typesEvent.change,
				filters: this.filters
			});
		}
	}

	// Следующая страница в пагинации
	nextPages() {
		if (!this.currentPage) return;

		this.currentPage++;
		this.triggerSelectFiters();
	}

	/**
	 * Изменение отображения кнопки "Загрузить еще"
	 * @param {Boolean} isShow Показать / скрыть кнопку
	 * @param {Boolean} isDisabled Вкл / выкл работу кнопки
	 */
	visibleBtnMore(isShow = true, isDisabled = false) {
		this.$btnMore.attr({
			hidden: !isShow,
			disabled: isDisabled
		});
	}

	// Изменение отображения кнопок в форме фильтров
	visibleBtnsFilters(isApply = false) {
		this.applied.change = isApply;

		if (!this.isMobStyle) return;

		this.$btnReset.attr("hidden", !isApply);
		this.$btnResetColor.attr("hidden", this.applied.quantityColor < 1);
		this.$btnMobApply.find("span").text(
			isApply ? "Применить" : "Показать все товары"
		);

		if (this.applied.quantity < 0) this.applied.quantity = 0;
		if (this.applied.quantityColor < 0) this.applied.quantityColor = 0;

		const counter = this.applied.quantity + this.applied.quantityColor + this.applied.sort;
		if (counter > 0) {
			this.$btnMobCounter.removeAttr("hidden").text(counter);
		}
		else {
			this.$btnMobCounter.attr("hidden", true);
		}
	}

	/**
	 * Получить данные фильтров для каталога/поиска/вишлиста.
	 * 
	 * В зависимости от режима возвращает либо объект (для catalog),
	 * либо экземпляр FormData (для поиска/вишлиста).
	 * 
	 * @param {boolean} isObject - Если true, возвращает объект фильтров (исп. в каталоге).
	 *                             Если false, возвращает FormData (исп. в поиске/вишлисте).
	 * @returns {Object|FormData} Данные фильтров для отправки в API.
	 *
	 * Структура возвращаемого объекта:
	 * {
	 *   order: string,
	 *   page_size: number,
	 *   page: number,
	 *   options: { [filterID: string]: number[] },
	 *   price_min?: number,
	 *   price_max?: number
	 * }
	 *
	 * Для FormData эти же поля добавляются как параметры формы,
	 * а фильтры опций в формате options[ID][]
	 */
	getSelectFilters(isObject = this.modeCatalog) {
		const $fitlers = this.isMobStyle ? this.$filtresMob : this.$filtres;
		const priceMin = Number($fitlers.find("input[name='price_min']:first").val());
		const priceMax = Number($fitlers.find("input[name='price_max']:first").val());
		const priceRange = this._getPriceRange();

		// Если необходим обычный объект
		if (isObject) {
			const data = {
				order: this._getSelectSorting(),
				page_size: this.pageSize,
				page: this.currentPage,
				options: this._getOptionsFilters()
			};

			if (!isNaN(priceMin) && priceMin > priceRange.min) {
				data.price_min = priceMin;
			}
			if (!isNaN(priceMax) && priceMax < priceRange.max) {
				data.price_max = priceMax;
			}
			return data;
		}

		// Если необходимы данные в виде FormData
		const formData = new FormData();
		formData.append("order", this._getSelectSorting() ?? "");
		formData.append("page_size", String(this.pageSize));
		formData.append("page", String(this.currentPage));

		if (!isNaN(priceMin) && priceMin > priceRange.min) {
			formData.append("price_min", String(priceMin));
		}
		if (!isNaN(priceMax) && priceMax < priceRange.max) {
			formData.append("price_max", String(priceMax));
		}

		const options = this._getOptionsFilters();
		Object.entries(options || {}).forEach(([filterID, values]) => {
			if (!Array.isArray(values)) return;
			values.forEach((value) => {
				formData.append(`options[${filterID}][]`, String(value));
			});
		});

		return formData;
	}

	/**
	 * Получить диапазон цен (для проверки активности фильтра)
	 * Использует filters.pricing из API или данные из DOM
	 */
	_getPriceRange() {
		if (this.filters?.pricing?.min != null && this.filters?.pricing?.max != null) {
			return {
				min: Number(this.filters.pricing.min),
				max: Number(this.filters.pricing.max)
			};
		}
		const $f = this.isMobStyle ? this.$filtresMob : this.$filtres;
		const $min = $f.find("input[name='price_min']:first");
		const $max = $f.find("input[name='price_max']:first");

		return {
			min: Number($min.attr("data-range-from") || $min.val() || 0),
			max: Number($max.attr("data-range-to") || $max.val() || Infinity)
		};
	}

	// Получить выбранные опции в фильтрах
	_getOptionsFilters() {
		let options = {};

		const $fitlers = this.isMobStyle ? this.$filtresMob : this.$filtres;
		const className = (this.isMobStyle ? ".mob-popup__group" : ".filters__group") + "[data-filter-id]";

		for (const block of $fitlers.find(className)) {
			if (block.dataset.filterId == "sort" || block.dataset.filterId == "price") continue;

			const filterID = block.dataset.filterId;
			if (!filterID || !filterID.length) continue;

			let values = [];
			for (const input of $(block).find("input:checked")) {
				values.push(Number(input.value));
			}
			// if (values.length) options[propertyID] = values;
			if (values.length) {
				options[filterID] = values
				// options.push({
				//     [filterID]: values
				// });
			}
		}

		return options;
	}

	// Получить примененную сортировку
	_getSelectSorting() {
		let value;
		if (this.isMobStyle) {
			value = this.$filtresMob.find(".options-sort__input:checked:first").val();
		} else {
			const $active = this.$filtres.find(".select_catalog-sort .select__option._active:first");
			value = $active.length ? $active.attr("data-value") : null;
			if (value == null) {
				value = this.$filtres.find(".catalog__sort option:selected").val();
			}
		}
		return this.getNameSort(value);
	}

	// Получить название сортировки
	getNameSort(value) {
		return this.modeCatalog ? this._getNameSortCatalog(value) : this._getNameSortWishlist(value);
	}

	// Получить название сортировки для каталога
	_getNameSortCatalog(value) {
		switch (value) {
			case '1':
				return '';
			case '2':
				return 'popular';
			case '3':
				return 'price';
			case '4':
				return 'descending_price';
		}
		return '';
	}

	// Получить название сортировки для вишлиста
	_getNameSortWishlist(value) {
		switch (value) {
			case '1':
				return '';
			case '2':
				return 'asc';
			case '3':
				return 'desc';
		}
		return '';
	}

	// вызов события изменения фильтров
	triggerSelectFiters() {
		this.applied.change = false;
		EventBus.publish(this.nameEvent, {
			method: this.typesEvent.change,
			filters: this.filters
		});
	}

	/**
	 * Сохранить фильтры в localStorage с датой сохранения
	 * @param {Object} data - объект для сохранения
	 */
	saveFiltres(data) {
		if (this.typePage === "search" || !this._availableLocalStorage) return;
		try {
			localStorage.setItem(this.nameKeyCached, JSON.stringify({
				data: data,
				savedAt: Date.now(),
			}));
		}
		catch (err) {
			console.warn(this._name, "Ошибка сохранения фильтров:", err);
			this._availableLocalStorage = false;
		}
	}

	// Чтение фильтров из памяти или, если его нет/неактуален, запросить новый
	async readingFilters() {
		if (this.modeCatalog) {
			this.filters = this.filters || {};
			EventBus.publish(this.nameEvent, {
				method: this.typesEvent.init,
				filters: this.filters
			});
			this._inited = true;
			return;
		}

		let cached;

		if (this.typePage === "wishlist") {
			try {
				const client = await ajaxAPI.shop.client.get();
				this.clientID = client?.authorized && client?.id ? client.id : null;
			}
			catch (_) { }
		}
		else {
			try {
				const data = localStorage.getItem(this.nameKeyCached);
				if (data) cached = JSON.parse(data);
			}
			catch (err) {
				console.warn(this._name, "Ошибка чтения фильтров из памяти:", err);
				this._availableLocalStorage = false;
			}
		}

		if (
			cached && cached?.savedAt &&
			typeof cached.savedAt === 'number' && Date.now() - cached.savedAt < this.TTL_MS
		) {
			this.filters = cached.data;
		}
		else {
			const formData = new FormData();
			formData.append("flow_id", "__flow_id__");

			if (this.clientID) {
				formData.append("customer[id]", this.clientID);
			}

			const newFitlers = await this.fetch(
				formData,
				"/filters",
				this.typePage
			);

			if (newFitlers && newFitlers?.options) {
				this.filters = newFitlers;
				this.saveFiltres(newFitlers, this.nameKeyCached);
			}
		}
		this.renderFilters();

		EventBus.publish(this.nameEvent, {
			method: this.typesEvent.init,
			filters: this.filters
		});
		this._inited = true;
	}

	// Отрисовка фильтров
	renderFilters() {
		if (!this.filters.options || !this.filters.pricing) {
			this.$filtres.find("[data-filter-panel]:first").attr("hidden", true);
			console.warn(this._name, "Фильтры не найдены");
			return;
		}

		if (this.isMobStyle) this._renderMobFilters();
		else this._renderPCFilters();

		EventBus.publish(this.nameEvent, {
			method: this.typesEvent.render,
			filters: this.filters
		});
	}

	// Рендер ПК фильтров
	_renderPCFilters() {
		const filtres = this.filters;

		// Фильтры цены
		const priceMin = Number(filtres.pricing.min ?? "0");
		const priceMax = Number(filtres.pricing.max ?? "0");

		let html = Template.render({
			priceMin: Math.ceil(priceMin),
			priceMax: Math.floor(priceMax)
		}, this.templates.filterItemPrice);

		// Остальные фильтры
		for (const option of filtres.options) {
			if (!option.values.length) continue;

			html += Template.render(option, this.templates.filterItem);
		}

		if (html.length > 0) {
			// this.$filtres.find(".select_catalog-sort:first").after(html);
			this.$filtres.find(".catalog__filters-group:first").html(html);
			window.EM_Module.spollers(
				[this.$filtres.get(0).querySelector(".catalog__filters-group")]
			);
			window.EM_Module.rangeInit();
		}
		else {
			this.$filtres.find(".catalog__filters-group:first").html("");
		}
	}

	// Рендер мобильных фильтров
	_renderMobFilters() {
		const filtres = this.filters;

		let html = "";
		for (const option of filtres.options) {
			if (!option.values.length) continue;

			html += option.id == this.filtersID.color ?
				Template.render(option, this.templates.filterMobColor) :
				Template.render(option, this.templates.filterMobItem);

			Template.render(
				option,
				option.id == this.filtersID.color
					? this.templates.filterMobColor
					: this.templates.filterMobItem
			);

			if (option.id == this.filtersID.color && option.values.length > 8) {
				this.$filtresMobColor.find(".mob-popup__filter-list:first").html(
					Template.render(option, this.templates.filterPopupMobColor)
				);
			}
		}

		const priceMin = Number(filtres.pricing.min ?? "0");
		const priceMax = Number(filtres.pricing.max ?? "0");

		html += Template.render({
			priceMin: Math.ceil(priceMin),
			priceMax: Math.floor(priceMax)
		}, this.templates.filterMobItemPrice);

		if (html.length > 0) {
			// this.$filtres.find(".select_catalog-sort:first").after(html);
			this.$filtresMob.find("[data-filter-id='sort']:first").after(html);
			window.EM_Module.rangeInit();
		}
		else {
			// this.$filtres.find(".catalog__filters-group:first").html("");
		}
	}

	// Принудительно обновить фильтры
	forceUpdate() {
		this.currentPage = 1;
	}

	/**
	 * Добавить фильтр
	 * @param {Object} filter Фильтра: id, itemID, img (если есть)
	 * @param {Boolean} isApply Добавить с примененеим фильтров 
	 */
	addFilter(filter, isApply = true) {
		if (!filter.id || !filter.itemID) return;

		this.$panelSelectFilters.find(`[data-selected-filter-id="${filter.itemID}"]`).remove();
		this.$panelSelectFilters.find(".selected-filters__list").append(
			Template.render(filter, this.templates.filterSelected)
		);
		this.$panelSelectFilters.removeAttr("hidden")

		if (isApply) {
			this.currentPage = 1;
			this.applied.change = false;

			EventBus.publish(this.nameEvent, {
				method: this.typesEvent.change,
				filters: this.filters,
				added: filter
			});
		}
	}

	/**
	 * Добавить фильтр цены
	 * @param {Object} filter Фильтр: id, priceMin, priceMax
	 * @param {Boolean} isApply Добавить с примененеим фильтров 
	 */
	addFilterPrice(filter, isApply = true) {
		if (!filter.id || !filter.priceMin || !filter.priceMax) return;

		const $filterPrice = this.$panelSelectFilters.find(`[data-filter-id="${filter.id}"]:first`);

		if ($filterPrice.length) {
			$filterPrice.find(".selected-filters__item-title").html(
				`<span>${Shop.money.format(filter.priceMin)}</span> - <span>${Shop.money.format(filter.priceMax)}</span>`
			)
		}
		else {
			this.$panelSelectFilters.find(".selected-filters__list").append(
				Template.render(filter, this.templates.filterSelectedPrice)
			);
			this.$panelSelectFilters.removeAttr("hidden")
		}

		if (isApply) {
			this.currentPage = 1;
			this.applied.change = false;

			EventBus.publish(this.nameEvent, {
				method: this.typesEvent.change,
				filters: this.filters,
				added: filter
			});
		}
	}

	/**
	 * Удаление фильтра
	 * @param {Object} element Элемент в DOM-дереве
	 * @param {Boolean} isApply Удалить с примененеим фильтров 
	 */
	removeFilter(element, isApply = true) {
		if (!element) return;

		const filterID = element.getAttribute("data-filter-id");
		const filterItemID = element?.getAttribute("data-selected-filter-id") ?? null;

		if (!filterID) return;

		if (this.$panelSelectFilters.find(".selected-filters__list:first").children().length < 2) {
			this.$panelSelectFilters
				.attr("hidden", true)
				.find(".selected-filters__list:first").html("");
		}
		else {
			element.remove();
		}

		if (filterID == "price") {
			this._clearFilterPrice();
		}
		else if (this.isMobStyle) {
			this.$filtresMob.find(
				`[data-filter-id="${filterID}"] .checkbox-btn__input[value="${filterItemID}"]:first`
			).prop("checked", false);

			if (filterID === String(this.filtersID.color)) {
				this.$filtresMobColor.find(
					`.checkbox__input[data-property-id="${filterID}"][value="${filterItemID}"]:first`
				).prop("checked", false);
			}
		}
		else {
			this.$filtres.find(
				`[data-filter-id="${filterID}"] .checkbox__input[value="${filterItemID}"]:first`
			).prop("checked", false);
		}

		if (isApply) {
			this.currentPage = 1;
			this.applied.change = false;

			EventBus.publish(this.nameEvent, {
				method: this.typesEvent.change,
				filters: this.filters,
				deleted: {
					filterID: filterID,
					filterItemID: filterItemID
				}
			});
		}
	}

	/**
	 * Очистка фильтров
	 * @param {Boolean} isApply Очистка с примененеим фильтров 
	 */
	clearFilters(isApply = true) {
		this._clearFilterPrice();

		if (this.isMobStyle) this._clearMobFilters();
		else this._clearPCFilters();

		this.$panelSelectFilters
			.attr("hidden", true)
			.find(".selected-filters__list:first").html("");

		this.currentPage = 1;
		this.applied.quantity = 0;
		this.applied.quantityColor = 0;
		this.applied.sort = false;

		this.visibleBtnsFilters(true);

		if (!isApply) return;

		this.applied.change = false;
		EventBus.publish(this.nameEvent, {
			method: this.typesEvent.clear,
			filters: this.filters
		});
	}

	/**
	 * Очистка мобильных цветов в фильтре
	 * @param {Boolean} isApply Очистка с примененеим фильтров 
	 */
	clearColorMobFilters(isApply = true) {
		if (!this.isMobStyle) return;

		this.$filtresMob.find(`[data-filter-id="${this.filtersID.color}"]:first .checkbox-btn__input:checked`).prop("checked", false);
		this.$filtresMobColor.find(".checkbox__input:checked").prop("checked", false);

		this.applied.quantityColor = 0;
		this.visibleBtnsFilters();
		``
		if (isApply) {
			this.currentPage = 1;
			this.applied.change = false;

			EventBus.publish(this.nameEvent, {
				method: this.typesEvent.change,
				filters: this.filters
			});
		}
	}

	_clearPCFilters() {
		const $sort = this.$filtres.find(".select_catalog-sort:first");
		const $nativeSort = this.$filtres.find(".catalog__sort:first");

		if ($sort.length) {
			$sort.find("select:first").val("");
			$sort.find(".select__option._active:first").removeClass("_active");
			$sort.find(".select__option:first").addClass("_active");
		} else if ($nativeSort.length) {
			$nativeSort.find("option:first").prop("selected", true);
		}

		this.$filtres.find(".checkbox__input:checked").prop("checked", false);
	}

	_clearMobFilters() {
		const $sort = this.$filtresMob.find("[data-filter-id='sort']:first");

		$sort.find(".options-sort__input:checked:first").prop("checked", false);
		$sort.find(".options-sort__input:first").prop("checked", true);

		this.$filtresMob.find(".checkbox-btn__input:checked").prop("checked", false);
		this.$filtresMobColor.find(".checkbox__input:checked").prop("checked", false);
	}

	_clearFilterPrice() {
		const $fitlers = this.isMobStyle ? this.$filtresMob : this.$filtres;
		const priceMin = $fitlers.find("input[name='price_min']:first").get(0);
		const priceMax = $fitlers.find("input[name='price_max']:first").get(0);

		if (priceMin) {
			priceMin.value = priceMin.dataset.rangeFrom;
			priceMin.dispatchEvent(new Event("change", { bubbles: true }));
		}
		if (priceMax) {
			priceMax.value = priceMax.dataset.rangeTo;
			priceMax.dispatchEvent(new Event("change", { bubbles: true }));
		}
	}

	async fetch(formData, type = "", typePage = "") {
		const response = await $.ajax({
			url: `https://insales.widgets.ibice.ru/api/jls-gateway/${typePage}${type}`,
			method: 'POST',
			// dataType: 'json',
			data: formData,
			processData: false,
			contentType: false,
			timeout: 10000
		}).fail((err) => {
			console.warn(this._name, "Ошибка выполнения запроса:", err);
		});

		if (!response) {
			console.warn(this._name, "Ошибка выполнения запроса:", response);
		}
		return response;
	}
}