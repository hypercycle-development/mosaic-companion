export class NodeManagerError extends Error {
  public status?: number;
  public url?: string;
  public responseBody?: any;

  constructor(message: string, status?: number, url?: string, responseBody?: any) {
    super(message);
    this.name = "NodeManagerError";
    this.status = status;
    this.url = url;
    this.responseBody = responseBody;
  }
}

export class InvalidNonceError extends NodeManagerError {
  constructor(message: string, status?: number, url?: string, responseBody?: any) {
    super(message, status, url, responseBody);
    this.name = "InvalidNonceError";
  }
}

export class PaymentRequiredError extends NodeManagerError {
  public payment?: any;
  public currencyType?: string;
  public txDriver?: string;

  constructor(message: string, status?: number, url?: string, responseBody?: any, currencyType?: string, txDriver?: string) {
    super(message, status, url, responseBody);
    this.name = "PaymentRequiredError";
    this.payment = responseBody;
    this.currencyType = currencyType;
    this.txDriver = txDriver;
  }
}
