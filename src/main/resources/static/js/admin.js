traverson.registerMediaType(TraversonJsonHalAdapter.mediaType,
    TraversonJsonHalAdapter);

var rootUri = '/',
    api = traverson.from(rootUri),
    fields = [{
        name: "amount",
        label: "Количество:",
        control: "input",
        type: "number"
    }, {
        name: "currency",
        label: "Тип валюты:",
        control: "input"
    }, {
        name: "rate",
        label: "Курс:",
        control: "input",
        type: "number"
    }, {
        name: "type",
        label: "Тип ордера:",
        placeholder: "BUY or SELL",
        control: "input"
    }, {
        name: "location.city",
        label: "Город:",
        control: "input"
    }, {
        name: "location.area",
        label: "Район:",
        control: "input"
    }, {
        name: "comment",
        label: "Комментарий:",
        control: "input"
    }, {
        name: "ctrl create",
        control: "button",
        label: "Создать"
    }, {
        name: "ctrl update hide",
        control: "button",
        label: "Обновить"
    }, {
        name: "ctrl delete hide",
        control: "button",
        label: "Удалить"
    }, {
        name: "ctrl expire hide",
        control: "button",
        label: "Закрыть"
    }, {
        name: "ctrl publish hide",
        control: "button",
        label: "Опубликовать"
    }];

var View = Backbone.View.extend({
    el: $(".container"),
    initialize: function () {
        _.bindAll(this, "render");
        this.model.bind("change reset", this.render);
    },
    render: function () {
        var $tbody = this.$("#ads-list tbody");
        $tbody.empty();
        _.each(this.model.models, function (data) {
            $tbody.append(new AdView({ model: data }).render().el);
        }, this);
    },
    events: {
        "click #createNew": function (e) {
            this.$el.find("tr").removeClass("highlight");
            e.preventDefault();
            controller.createNew();
        }
    }
});

var AdView = Backbone.View.extend({
    tagName: "tr",
    template: _.template($("#ad-template").html()),
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
    },
    events: {
        "click": function () {
            form.model.set(this.model.toJSON());
            controller.getOperations(this.model);
            this.$el.addClass("highlight").siblings().removeClass("highlight");
        }
    }
});

var AdsModel = Backbone.RelationalHalResource.extend({
    initialize: function () {
        var self = this;
        api.jsonHal()
            .follow("currency-black-market:ads")
            .getUri(function (err, uri) {
                if (err) {
                    console.log(err);
                    return;
                }
                self.halUrl = uri;
            });
    },
    defaults: {
        location: {
            city: null,
            area: null
        },
        amount: null,
        type: null,
        publishedAt: null,
        rate: null,
        currency: null,
        comment: null,
        phoneNumber: null
    }
});

var OrdersResource = Backbone.RelationalHalResource.extend({
    initialize: function (options) {
        var self = this;
        api.jsonHal()
            .follow("currency-black-market:ads", "search", "currency-black-market:my")
            .getUri(function (err, uri) {
                if (err) {
                    console.log(err);
                    return;
                }
                self.url = uri;
                self.updateCollection();
            });
        api.jsonHal()
            .follow("currency-black-market:users", "search", "currency-black-market:current-user")
            .getResource(function (err, res) {
                if (err) {
                    console.log(err);
                    return;
                }
                self.set("user", res._links.self.href); //TODO save and use for make create
            });
    },

    updateCollection: function () {
        var self = this;
        self.fetch().done(function () {
            var models = self.embedded("currency-black-market:ads", {all: true});
            models = models.map(function (model) {
                return new AdsModel(model);
            });
            adsCollection.reset(models);
        });
    }
});


var ads = new AdsModel();
var adsCollection = new Backbone.Collection();
new View({model: adsCollection}).render();
var ordersResource = new OrdersResource();


var form = new Backform.Form({
    el: $("#form"),
    model: ads,
    fields: fields,
    events: {
        "click .update": function (e) {
            e.preventDefault();
            controller.makeAction("update", this.model.toJSON());
            return false;
        },
        "click .create": function (e) {
            e.preventDefault();
            this.model.set("user", ordersResource.get("user"));
            controller.makeAction("create", this.model.toJSON());
            return false;
        },
        "click .publish": function (e) {
            e.preventDefault();
            controller.makeAction("publish", this.model.toJSON());
            return false;
        },
        "click .expire": function (e) {
            e.preventDefault();
            this.model.set("status", "OUTDATED");
            controller.makeAction("expire", this.model.toJSON());
            return false;
        },
        "click .delete": function (e) {
            e.preventDefault();
            controller.makeAction("delete", this.model.toJSON());
            return false;
        }
    }
}).render();

var Controller = function (view) {
    var self = this;
    self.view = view;
    self.status = $("#status");
};

Controller.prototype.setModel = function (model) {
    this.model = model;
};

Controller.prototype.getOperations = function (model) {
    this.setModel(model);
    ["update", "create", "publish", "delete", "expire"].forEach(function(relation) {
        this.initOperation(model, relation);
    }, this);
};

Controller.prototype.initOperation = function (model, relation) {
    var el = this.view.$el.find("." + relation);
    model.hasLink(relation) ? el.removeClass("hide") : el.addClass("hide");
};

Controller.prototype.createNew = function () {
    this.setModel(ads);
    this.view.model.set(ads.defaults);
    this.view.model.set("user", ordersResource.get("user"));
    this.view.$el.find(".form-group.ctrl:not(.create)").addClass("hide");
    this.view.$el.find(".create").removeClass("hide");
};
Controller.prototype.setModel = function (model) {
    this.model = model;
};

Controller.prototype.getModel = function () {
    return this.model || ads;
};

Controller.prototype.makeAction = function (action, data) {
    var self = this,
        model = this.getModel(),
        options = {},
        actions = {
            "create": "create",
            "update": "patch",
            "publish": "create",
            "expire": "create",
            "delete": "delete"
        },
        status = {
            "create": "создана",
            "update": "обновлена",
            "publish": "опубликована",
            "expire": "закрыта",
            "delete": "удалена"
        };

    if (action !== "create") {
        options = {
            url: model.link(action).href()
        }
    }
    model.set(data, { silent: true });
    model.sync(actions[action], model, options)
        .done(function () {
            ordersResource.updateCollection();
            self.createNew();
            self.status.text("Ваша заявка успешно " + status[action]);
            setTimeout(function() { self.status.text("") }, 2000);
        })
        .fail(function (error) {
            console.error(error);
        });
};

var controller = new Controller(form);