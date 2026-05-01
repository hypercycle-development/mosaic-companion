export class PolicyDeniedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PolicyDeniedError';
    }
}
export class UserRejectedError extends Error {
    constructor(message = 'User rejected the transaction approval request.') {
        super(message);
        this.name = 'UserRejectedError';
    }
}
