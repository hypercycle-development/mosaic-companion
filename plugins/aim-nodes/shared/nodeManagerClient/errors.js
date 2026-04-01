export class NodeManagerError extends Error {
    status;
    url;
    responseBody;
    constructor(message, status, url, responseBody) {
        super(message);
        this.name = "NodeManagerError";
        this.status = status;
        this.url = url;
        this.responseBody = responseBody;
    }
}
export class InvalidNonceError extends NodeManagerError {
    constructor(message, status, url, responseBody) {
        super(message, status, url, responseBody);
        this.name = "InvalidNonceError";
    }
}
export class PaymentRequiredError extends NodeManagerError {
    payment;
    currencyType;
    txDriver;
    constructor(message, status, url, responseBody, currencyType, txDriver) {
        super(message, status, url, responseBody);
        this.name = "PaymentRequiredError";
        this.payment = responseBody;
        this.currencyType = currencyType;
        this.txDriver = txDriver;
    }
}
