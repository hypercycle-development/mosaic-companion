import asyncio
import concurrent.futures
import json
import signal
import sys

from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse

from pyhypercycle_aim.exceptions import AppException


def aim_uri(uri=None, methods=None, endpoint_manifest=None, **kwargs):
    if not uri:
        raise AppException("`uri` must be defined")
    if not methods:
        raise AppException("`methods` must be defined")
    if not endpoint_manifest:
        raise AppException("`endpoint_manifest` must be defined")

    endpoint_manifest['uri'] = uri
    endpoint_manifest['input_methods'] = methods
    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            async def wrapper(*args, **kwargs):
                return await func(*args, **kwargs)
            wrapper._uri = uri
            wrapper._methods = methods
            wrapper._endpoint_manifest = endpoint_manifest
            wrapper._kwargs = kwargs
            return wrapper
        else:
            def wrapper(*args, **kwargs):
                return func(*args, **kwargs)
            wrapper._uri = uri
            wrapper._methods = methods
            wrapper._endpoint_manifest = endpoint_manifest
            wrapper._kwargs = kwargs
            return wrapper
    return decorator


def to_async(function, *args, **kwargs):
    executor = concurrent.futures.ThreadPoolExecutor()

    def run_function():
        return function(*args, **kwargs)

    future = executor.submit(run_function)
    return asyncio.wrap_future(future)


#CORS response helper
def JSONResponseCORS(data, headers=None, costs=None, status_code=200):
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Credentials": "false"
    }

    if headers is None:
        headers = {}
    if costs is not None:
        headers['costs'] = json.dumps(costs)

    for key in cors_headers:
        headers[key] = cors_headers[key]
    return JSONResponse(data, headers=headers, status_code=status_code)


def HTMLResponseCORS(data, headers=None, costs=None):
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Credentials": "false"
    }

    if headers is None:
        headers = {}
    if costs is not None:
        headers['costs'] = json.dumps(costs)
    for key in cors_headers:
        headers[key] = cors_headers[key]
    return HTMLResponse(data, headers=headers)

def FileResponseCORS(filedata, filename, media_type=None, headers=None, costs=None, status_code=200):
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Credentials": "false"
    }    
    if headers is None:
        headers = {}
    if costs is not None:
        headers['costs'] = json.dumps(costs)
    for key in cors_headers:
        headers[key] = cors_headers[key]

    headers["Content-Disposition"] = f'attachment; filename="{filename}"'

    if media_type is None:
        media_type = "application/octet-stream"

    return Response(
        content=filedata,
        media_type=media_type,
        headers=headers
    )

def handle_interrupt(signal, frame):
    #Makes shutting down a bit easier
    # Cleanup code here (if any)
    print("Interrupted. Exiting...")
    sys.exit(0)


# Register the signal handler
signal.signal(signal.SIGINT, handle_interrupt)

HTML_404_PAGE = ""
HTML_500_PAGE = ""


async def not_found(request: Request, exc: HTTPException):
    return HTMLResponse(content=HTML_404_PAGE, status_code=exc.status_code)


async def server_error(request: Request, exc: HTTPException):
    return HTMLResponse(content=HTML_500_PAGE, status_code=exc.status_code)


default_exception_handlers = {
    404: not_found,
    500: server_error
}
