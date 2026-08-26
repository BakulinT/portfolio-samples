/**
 * Wishlist JS для InSales
 * Модуль для реализации вишлииста JLS API
 * Версия: 1.0.0
 */
class WishlistAPI {
    constructor(config) {
        this._name = "[EM.Wishlist]";
        this._inited = false;
        this._tracking = config.trackingWishlist ?? true;

        // Ограничение списка избранного
        this.maxItems = 30;

        // Список вишлиста
        this.wishlistIDs = [];

        this.classes = {
            iconAdded: "favorites-added",
            iconCounterEmpty: "favorites-empty"
        };
        // Типы операций с вишлистом
        this.type = {
            remove: "remove",
            get:    "get",
            add:    "add",
            init:   "init"
        };
        this.nameEventUpdate = "em_wishlist:update";
    }

    async init(notRenderIcon = false) {
        const client = await ajaxAPI.shop.client.get();

        this.clientID = client?.authorized && client?.id ? client.id : null;

        await this.setWishlist();
        this.checkOverflowWishilst();

        if (!notRenderIcon) this.renderIcons();

        document.addEventListener("click", this.click.bind(this));

        this._inited = true;
        
        EventBus.subscribe(this.nameEventUpdate, this.updateWishlist);
        EventBus.publish(this.nameEventUpdate, {
            wishlist: this.wishlistIDs,
            method: this.type.init
        });
    }

    click(e) {
        // Клик по иконке 
        if (e.target.getAttribute("data-wishlist-trigger")) this.switch(e.target);
    }

    // Отслеживание обновления вишлиста
    updateWishlist(data) {
        const count = data.wishlist.length;

        for (const counter of document.querySelectorALL("[data-wishlist-counter]")) {
            counter.innerHTML = count;
            if (count > 0) {
                counter.classList.remove(this.classes.iconCounterEmpty);
            }
            else {
                counter.classList.add(this.classes.iconCounterEmpty);
            }
        }
        
        if (!this._tracking) return;
        // Изменение иконок
        for (const btn of document.querySelectorALL(`[data-wishlist-trigger="${data.item.product_id}"]`)) {
            if (data.method == this.type.remove) {
                btn.classList.remove(this.classes.iconAdded);
            }
            else if (data.method == this.type.add) {
                btn.classList.add(this.classes.iconAdded);
            }
        }
    }

    async setWishlist() {
        const response = await this.get({ page: 1, page_size: this.maxItems });

        if (response.wishlist && response.wishlist.length > 0) {
            this.wishlistIDs = response.wishlist.map( item => item.product_id);
        }
    }

    async switch(btn) {
        const productID = Number(btn?.getAttribute("data-wishlist-trigger"));
        if (!btn || !productID || isNaN(productID)) return;

        if (btn.classList.contains(this.classes.iconAdded)) {
            if (await this.remove(productID)) {
                btn.classList.remove(this.classes.iconAdded);
            }
        }
        else if (await this.add(productID)) {
            btn.classList.add(this.classes.iconAdded);
        }
    }

    // Получить список вишлиста
    get(filtres, isCache = false) {
        if (isCache) return this.wishlistIDs;

        return this.fetch(this.type.get, filtres);
    }

    // Добавить товар в избранное
    async add(productID, variantID) {
        if (!productID) return false;

        const response = await this.fetch(this.type.add, {
            product_id: productID,
            variant_id: variantID ?? null
        });

        if (!response?.success) return false;

        this.wishlistIDs.push(productID);

        if (this.wishlistIDs.length > this.maxItems) {
            const delItem = this.wishlistIDs.splice(0, 1)[0];

            EventBus.publish(this.nameEventUpdate, {
                wishlist: this.wishlistIDs,
                item: {
                    product_id: delItem.product_id,
                    variant_id: delItem.variant_id
                },
                method: this.type.remove
            });
        }

        EventBus.publish(this.nameEventUpdate, {
            wishlist: this.wishlistIDs,
            item: {
                product_id: productID,
                variant_id: variantID ?? null
            },
            method: this.type.add
        });

        return true;
    }

    // Удалить товар из избранного
    async remove(productID, variantID) {
        if (!productID) return false;

        const response = await this.fetch(this.type.remove, {
            product_id: productID,
            variant_id: variantID ?? null
        });

        if (!response?.success) return false;

        this.wishlistIDs.slice(this.wishlistIDs.indexOf(productID), 1);

        EventBus.publish(this.nameEventUpdate, {
            wishlist: this.wishlistIDs,
            item: {
                product_id: productID,
                variant_id: variantID ?? null
            },
            method: this.type.remove
        });

        return true;
    }

    // Провекра вишлиста на переполнение
    checkOverflowWishilst() {
        if (this.wishlistIDs.length <= this.maxItems) return;

        const delItems = this.wishlistIDs.splice(this.maxItems, this.wishlistIDs.length - this.maxItems);
        
        for (const productID of delItems) {
            setTimeout(() => {
                this.fetch(this.type.remove, { product_id: productID });
            }, 50);
        }
    }

    // Принудительно обновить избранное
    async forceUpdate() {
        const response = await this.setWishlist();

        this.renderIcons();

        EventBus.publish(this.nameEventUpdate, {
            wishlist: this.wishlistIDs,
            method: this.type.update
        });
    }

    // Отрисовка состояния активных иконок
    async renderIcons() {
        for (const productID of this.wishlistIDs) {
            document.querySelectorAll(`[data-wishlist-trigger="${productID}"]`).forEach(icon => {
                icon.classList.add(this.classes.iconAdded);
            });
        }
    }

    async fetch(type, data = {}) {
        const response = await $.ajax({
            url: `https://insales.widgets.ibice.ru/api/jls-gateway/wishlist/${type}`,
            method: 'POST',
            dataType: 'json',
            data: {
                flow_id: "__flow_id__",
                customer_id: this.clientID,
                ...data
            },
            timeout: 10000
        }).fail((err) => {
            console.warn(this._name, "Ошибка выполнения поиска:", err);
        });

        if (!response) {
            console.warn(this._name, "Ошибка выполнения поиска:", response);
        }
        return response;
    }
}

// Пример инициализации
document.addEventListener("DOMContentLoaded", function() {
    window.EM_Module = window.EM_Module || {};

    EM_Module.Wishlist = new WishlistAPI();
    EM_Module.Wishlist.init(!window.location.pathname.includes("/favorites"));
});