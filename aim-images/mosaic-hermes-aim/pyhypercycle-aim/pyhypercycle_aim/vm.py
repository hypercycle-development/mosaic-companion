
class VMProgram:
    """
        Stub for VMPrograms in python. Additional functionality to be added later.
    """

def AIMCall(name, request, headers=None):
    if not headers:
        headers = {}
    return {"status": "aim_call", "aim": {"name": name}, "request": request, "headers": headers}
    return {"status": "aim_call", "aim": {"name": name, "address": "localhost:8000"}, "request": request}
    return {"status": "aim_call", "aim": {"name": name, "address": "localhost:8000", "version": ">0.2.1", "slot": 1}, "request": req}

