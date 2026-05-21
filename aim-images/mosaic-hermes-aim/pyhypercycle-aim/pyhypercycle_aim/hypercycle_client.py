import sys
import json
import requests
from urllib.parse import quote
from websocket import create_connection, WebSocketConnectionClosedException
import pprint
import time
import re
import hashlib
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct
import argparse


client_config = {
    "seed_hosts": ["3.17.97.74:8000"],
    "driver": "ethereum",
    "rpc_provider": "https://eth.llamarpc.com",
    "network": "mainnet"
}

currencies = {"ethereum": {
    "mainnet": {
        "USDC": {"address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "type": "erc20", "decimals": 6},
        "HyPC": {"address": "0xeA7B7DC089c9a4A916B5a7a37617f59fD54e37E4", "type": "erc20", "decimals": 6},
    }
}}

chains = {"ethereum": {"chain_id": 1},
          "sepolia": {"chain_id": 11155111}}

erc20_abi = json.loads("""[{"constant": true, "inputs": [], "name": "name", "outputs": [{"name": "", "type": "string"}], "payable": false, "stateMutability": "view", "type": "function"}, {"constant": false, "inputs": [{"name": "_spender", "type": "address"}, {"name": "_value", "type": "uint256"}], "name": "approve", "outputs": [{"name": "", "type": "bool"}], "payable": false, "stateMutability": "nonpayable", "type": "function"}, {"constant": true, "inputs": [], "name": "totalSupply", "outputs": [{"name": "", "type": "uint256"}], "payable": false, "stateMutability": "view", "type": "function"}, {"constant": false, "inputs": [{"name": "_from", "type": "address"}, {"name": "_to", "type": "address"}, {"name": "_value", "type": "uint256"}], "name": "transferFrom", "outputs": [{"name": "", "type": "bool"}], "payable": false, "stateMutability": "nonpayable", "type": "function"}, {"constant": true, "inputs": [], "name": "decimals", "outputs": [{"name": "", "type": "uint8"}], "payable": false, "stateMutability": "view", "type": "function"}, {"constant": true, "inputs": [{"name": "_owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "balance", "type": "uint256"}], "payable": false,  "stateMutability": "view", "type": "function"}, {"constant": true, "inputs": [], "name": "symbol", "outputs": [{"name": "", "type": "string"}], "payable": false, "stateMutability": "view", "type": "function"}, {"constant": false, "inputs": [{"name": "_to", "type": "address"}, {"name": "_value", "type": "uint256"}], "name": "transfer","outputs": [{"name": "","type": "bool"}],"payable": false,"stateMutability": "nonpayable","type": "function"},{"constant": true,"inputs": [{"name": "_owner","type": "address"},{"name": "_spender","type": "address"}],"name": "allowance","outputs": [{"name": "","type": "uint256"}],"payable": false,"stateMutability": "view","type": "function"},{"payable": true, "stateMutability": "payable", "type": "fallback"},{"anonymous": false,"inputs": [{"indexed": true,"name": "owner","type": "address"},{"indexed": true,"name": "spender","type": "address"},{"indexed": false,"name": "value","type": "uint256"}],"name": "Approval","type": "event"},{"anonymous": false,"inputs": [{"indexed": true,"name": "from","type": "address"},{"indexed": true,"name": "to","type": "address"},{"indexed": false,"name": "value","type": "uint256"}], "name": "Transfer", "type": "event"}]""")


class HyperCycleClient:
    @classmethod
    def _get_currency(cls, currency):
        driver = client_config.get("driver")
        network = client_config.get("network")
        return currencies.get(driver,{}).get(network,{}).get("address","")
        
    @classmethod
    def _get_chain_id(cls, currency):
        driver = client_config.get("driver")
        return chains.get(driver,{}).get("chain_id",1)

    @classmethod
    def sign_message(cls, message, sender, pk):
        encoded_message = encode_defunct(text=message)
        signed_message = Account.sign_message(encoded_message, pk)
        return signed_message.signature.hex()

    @classmethod
    def form_protocol_v2_message(cls, headers, method, uri, body):
        signed_headers_match = [
            re.compile(r'^tx-'),
            re.compile(r'^currency-type$'),
            re.compile(r'^cost_only$'),
            re.compile(r'^cost-only$'),
            re.compile(r'^ispublic$')
        ]
    
        message = f"AIM ProtocolV2 Signature:\n{method.upper()}\n{uri}\n"
        message_headers = {}
        ignored_headers = ["tx-signature", "tx-signed-headers"]
        valid = True

        sorted_headers = sorted(headers.keys())
        for header in sorted_headers:
            header_lc = header.lower()
            if header_lc in ignored_headers:
                continue
            for test_regex in signed_headers_match:
                if test_regex.match(header_lc):
                    message += f"{header_lc}: {headers[header]}\n"
                    message_headers[header] = 1
                    break

        assert 'tx-nonce' in {k.lower() for k in message_headers.keys()}

        if body:
            print([body])
            hash_body = cls._hash_blob(body)
            message += f"hash-body: {hash_body}"
        return {"message": message, "valid": valid}

    @classmethod
    def _hash_blob(cls, blob):
        hash_object = hashlib.sha256(blob)
        return hash_object.hexdigest()

    @classmethod
    def _rpc_request(cls, path, params=None, timeout=20):
        """Make a request to the RPC service on a seed host."""
        for seed_host in client_config["seed_hosts"]:
            try:
                url = f"http://{seed_host}{path}"
                res = requests.get(url, params=params, timeout=timeout)
                res.raise_for_status()
                return res.json()
            except requests.RequestException:
                continue
        return None

    @classmethod
    def list_nodes(cls, network=None, aim_name=None, aim_version=None, aim_uri=None,
                   status="alive", limit=None, order="desc", order_by="last_updated",
                   node_version=None, timeout=20):
        """List nodes via RPC search. Returns list of node addresses (or full data if limit=1 and single result)."""
        params = {}
        if network is not None:
            params["network"] = network
        if aim_name is not None:
            params["aim_name"] = aim_name
        if aim_version is not None:
            params["aim_version"] = aim_version
        if aim_uri is not None:
            params["aim_uri"] = aim_uri
        if status is not None:
            params["status"] = status
        if limit is not None:
            params["limit"] = limit
        if order is not None:
            params["order"] = order
        if order_by is not None:
            params["order_by"] = order_by
        if node_version is not None:
            params["node_version"] = node_version

        res = cls._rpc_request("/rpc/search", params=params, timeout=timeout)
        if res is None:
            return []
        nodes = res.get("result", res) if isinstance(res, dict) else res
        if not isinstance(nodes, list):
            return []
        return [n.get("address") for n in nodes if isinstance(n, dict) and n.get("address")]

    @classmethod
    def node_info(cls, node, timeout=20):
        """Get node info via RPC from seed host."""
        encoded_address = quote(node, safe="")
        res = cls._rpc_request(f"/rpc/node/{encoded_address}", timeout=timeout)
        if res is None:
            return None
        return res.get("result", res) if isinstance(res, dict) else res

    @classmethod
    def get_available_aims(cls, network=None, timeout=20):
        """Get available AIMs across nodes via RPC."""
        params = {}
        if network is not None:
            params["network"] = network
        res = cls._rpc_request("/rpc/aims", params=params, timeout=timeout)
        if res is None:
            return None
        return res.get("result", res) if isinstance(res, dict) else res
 
    @classmethod
    def connect_to_node(cls, node, pk, amount, currency, driver):
        node_data = cls.node_info(node)
        driver = node_data['tm']['driver']
        hotwallet_address = node_data['tm']['address']
        w3 = Web3(Web3.HTTPProvider(client_config.get("rpc_provider")))
        currency_type = cls._get_currency(currency)
        chain_id = cls._get_chain_id(currency)
        erc20_instance = w3.eth.contract(address=currency_type, abi=erc20_abi)
        
        client_address = w3.eth.account.from_key(pk)
        nonce = w3.eth.get_transaction_count(client_address)
        built_txn = self.erc20_instance.functions.transfer(hotwallet_address, amount).build_transaction({
            "chainId": chain_id,  # sepolia
            "gas": 70000,  #
            "maxFeePerGas": w3.to_wei('2', 'gwei'),
            "maxPriorityFeePerGas": w3.to_wei("1", "gwei"),
            "nonce": nonce
        })
        signed_txn = w3.eth.account.sign_transaction(built_txn, private_key=pk)
        signed_hash = signed_txn.hash
        print("sending")
        w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        txid = w3.to_hex(self.w3.keccak(signed_txn.rawTransaction))
        print("txid:", txid)
        cls.resume_deposit(node, txid, client_address, currency)
        return txid

    @classmethod
    def resume_deposit(cls, node, txid, sender, currency, driver):
        driver = client_config['driver']
        headers = {"tx-id": txid, "tx-sender":sender, 'currency-type': currency, 'tx-driver': driver}
        res = requests.post(f"http://{node}/balance", "",  headers=headers).json()
        return res

    @classmethod
    def get_balance(cls, node, address=None, pk=None, driver=None):
        if not address:        
            w3 = Web3(Web3.HTTPProvider(client_config.get("rpc_provider")))
            address = w3.eth.account.from_key(pk)
        headers = {'tx-sender': address, "tx-driver": driver}

        res = requests.get(f"http://{node}/balance", headers=headers).json()
        return res

    @classmethod
    def get_manifest(cls, node, aim_slot):
        res = requests.get(f"http://{node}/aim/{aim_slot}/manifest.json").text
        #print(res)
        return res

    @classmethod
    def call(cls, node, pk, aim_slot, method, uri, headers, body=None, protocol_version="2", driver="ethereum", cost_only=False, is_public=False):
        gen = cls._call(node, pk, aim_slot, method, uri, headers, body, protocol_version, 
                        driver, cost_only, is_public)
        if method in ["get", "post"]:
            try:
                result = next(gen)
            except StopIteration as e:
                return e.value
        else:
            return gen

    @classmethod
    def _call(cls, node, pk, aim_slot, method, uri, headers, body=None, protocol_version="2", driver="ethereum", cost_only=False, is_public=False):
        #get user nonce
        w3 = Web3(Web3.HTTPProvider(client_config.get("rpc_provider")))
        sender = w3.eth.account.from_key(pk).address
        
        if isinstance(body, dict):
            body = json.dumps(body)
        
        nobj = requests.get(f"http://{node}/nonce", headers={'sender': sender}).json()
        nonce = nobj['nonce']
        #form request:
        headers = {"tx-id": "", "tx-sender":sender, 'tx-origin': sender,
                   'currency-type': "USDC", "spend_order": "USDC,HyPC",
                   'tx-max-spend': headers.get("tx-max-spend",''),
                   'tx-driver': driver, 'tx-protocol': protocol_version}
        if cost_only:
            headers['cost_only'] = "1"
            headers['cost-only'] = "1"
        if is_public:
            headers['isPublic'] = "1"
        else:
            headers['tx-nonce'] = nonce
            if protocol_version == "1":
                sig = cls.sign_message(nonce, sender, pk)
            else:
                encodedBody = body
                if isinstance(body, str):
                    encodedBody = encodedBody.encode('utf-8')
                if method.lower() == "websocket":
                   uri_path = f"/vm/{aim_slot}{uri}"
                else:
                    uri_path = f"/aim/{aim_slot}{uri}"

                message = cls.form_protocol_v2_message(headers, method, uri_path, encodedBody)
                print('-----------------------------------')
                print(message['message'])
                print('----------------------------------')
                sig = cls.sign_message(message['message'], sender, pk)
            headers['tx-signature'] = sig
        if method.lower() == "get":
            res = requests.get(f"http://{node}/aim/{aim_slot}{uri}", headers=headers)
            res = res.text
        elif method.lower() == "post":
            res = requests.post(f"http://{node}/aim/{aim_slot}{uri}", headers=headers, data=body)
            res = res.text
        elif method.lower() == "websocket":
            res = yield from websocket_call(f"ws://{node}/vm/{aim_slot}{uri}", headers=headers,body=body)
        return res



def websocket_call(uri, headers, body):
    print(uri)
    res = None
    try:
        ws = create_connection(uri, header=headers)#, header=[f"{k}: {v}" for k, v in headers.items()])
        print(headers)
        print("Connected to server.")
        ws.send(body)
        while True:
            try:
                response = ws.recv()
                print("============================")
                print(response)
                res = json.loads(response)

                if res.get('status') == "return":
                    print("Returned", res['result'])
                    break
                elif res.get('status') == "partial":
                    print("Partial", res['result'])
                    send_bytes = yield res
                    print("FFFFFFFFDDDDDDDDDDDD", send_bytes)
                    ws.send(send_bytes)
                else:
                    print(res.get("status"), "LLLLLLLLLLLLL")
                    print("ISSUE", res)
                    ws.send(json.dumps({"status": "???"}))
            except WebSocketConnectionClosedException:
                print("Connection closed by server.")
                break
    finally:
        ws.close()
    return res


class ClientCLI:
    def __init__(self):
        self.parser = argparse.ArgumentParser(description="HyperCycle Client CLI")
        self.subparsers = self.parser.add_subparsers(dest="command", help="Available commands")

        # List Nodes Command
        list_nodes_parser = self.subparsers.add_parser("list-nodes", help="List available HyperCycle nodes (via RPC search).")
        list_nodes_parser.add_argument("--network", type=str, help="Filter by network (e.g., mainnet, testnet).")
        list_nodes_parser.add_argument("--aim-name", type=str, help="Filter nodes that have an AIM with this name.")
        list_nodes_parser.add_argument("--aim-version", type=str, help="Filter nodes that have an AIM with this version.")
        list_nodes_parser.add_argument("--aim-uri", type=str, help="Filter nodes that have an AIM with this URI.")
        list_nodes_parser.add_argument("--status", type=str, choices=["alive", "dead"], default="alive",
                                       help="Filter by node status (default: alive).")
        list_nodes_parser.add_argument("--limit", type=int, help="Maximum number of nodes to return.")
        list_nodes_parser.add_argument("--order", type=str, choices=["asc", "desc"], default="desc",
                                       help="Sort order (default: desc).")
        list_nodes_parser.add_argument("--order-by", type=str, default="last_updated",
                                       help="Field to sort by (default: last_updated).")
        list_nodes_parser.add_argument("--node-version", type=str,
                                       help="Filter by node version (e.g., '>=0.4.16', '==0.4.16').")
        list_nodes_parser.set_defaults(func=self.list_nodes)

        # Node Info Command
        node_info_parser = self.subparsers.add_parser("node-info", help="Get information about a specific HyperCycle node (via RPC).")
        node_info_parser.add_argument("node", type=str, help="The address of the node (e.g., 'localhost:8000').")
        node_info_parser.set_defaults(func=self.node_info)

        # Get Available AIMs Command
        get_aims_parser = self.subparsers.add_parser("get-aims", help="Get available AIMs across nodes (via RPC).")
        get_aims_parser.add_argument("--network", type=str, help="Filter by network.")
        get_aims_parser.set_defaults(func=self.get_aims)

        # Connect Command
        connect_parser = self.subparsers.add_parser("connect", help="Connect to a HyperCycle node by sending tokens.")
        connect_parser.add_argument("node", type=str, help="The address of the node.")
        connect_parser.add_argument("--pk", type=str, required=True, help="Your private key for transaction signing.")
        connect_parser.add_argument("--amount", type=float, required=True, help="The amount of currency to send.")
        connect_parser.add_argument("--currency", type=str, default="USDC", help="The currency symbol (e.g., 'USDC').")
        connect_parser.add_argument("--driver", type=str, default="ethereum", help="The payment driver (e.g. ethereum, base).")

        connect_parser.set_defaults(func=self.connect)

        # Get Balance Command
        get_balance_parser = self.subparsers.add_parser("get-balance", help="Get the balance for an address on a node.")
        get_balance_parser.add_argument("node", type=str, help="The address of the node.")
        get_balance_parser.add_argument("--address", type=str, help="The public address to query balance for. If not provided, --pk must be used.")
        get_balance_parser.add_argument("--pk", type=str, help="Your private key to derive the address for balance query.")
        get_balance_parser.add_argument("--driver", type=str, default="ethereum", help="The payment driver (e.g. ethereum, base).")
        get_balance_parser.set_defaults(func=self.get_balance)

        # Get Manifest Command
        get_manifest_parser = self.subparsers.add_parser("get-manifest", help="Get the manifest for a specific AIM slot on a node.")
        get_manifest_parser.add_argument("node", type=str, help="The address of the node.")
        get_manifest_parser.add_argument("aim_slot", type=int, help="The AIM slot number.")
        get_manifest_parser.add_argument("--driver", type=str, default="ethereum", help="The payment driver (e.g. ethereum, base).")
        get_manifest_parser.set_defaults(func=self.get_manifest)

        # Call AIM Command
        call_parser = self.subparsers.add_parser("call", help="Make a call to an AIM on a HyperCycle node.")
        call_parser.add_argument("node", type=str, help="The address of the node.")
        call_parser.add_argument("--pk", type=str, required=True, help="Your private key for transaction signing.")
        call_parser.add_argument("aim_slot", type=int, help="The AIM slot number.")
        call_parser.add_argument("method", type=str, choices=["GET", "POST"], help="The HTTP method (GET or POST).")
        call_parser.add_argument("uri", type=str, help="The URI for the AIM call (e.g., '/cost').")
        call_parser.add_argument("--headers", type=str, default="{}", help="JSON string of headers to include (e.g., '{\"Content-Type\": \"application/json\"}').")
        call_parser.add_argument("--body", type=str, help="JSON string or plain text for the request body.")
        call_parser.add_argument("--protocol-version", type=str, default="2", help="Protocol version (e.g., '1', '2').")
        call_parser.add_argument("--driver", type=str, default="ethereum", help="Blockchain driver (e.g., 'ethereum').")
        call_parser.add_argument("--cost-only", action="store_true", help="If set, only return cost information.")
        call_parser.add_argument("--is-public", action="store_true", help="If set, indicates a public call not requiring nonce/signature.")
        call_parser.set_defaults(func=self.call_aim)

        # Configuration file argument (global)
        self.parser.add_argument("--config", type=str, help="Path to a JSON configuration file (e.g., --config client_config.json).")

    def start(self):
        args = self.parser.parse_args()

        if args.config:
            self._load_config(args.config)
        if args.config:
            pk = client_config.get("pk","")
            if not args.pk:
                args.pk = pk
                
        if hasattr(args, "address") and not args.address and args.pk:
            w3 = Web3(Web3.HTTPProvider(client_config.get("rpc_provider")))
            args.address = w3.eth.account.from_key(args.pk).address
        if hasattr(args, "driver") and not args.driver:
            args.driver = client_config.get('driver')
        if hasattr(args, 'func'):
            args.func(args)
        else:
            self.parser.print_help()

    def _load_config(self, filename):
        try:
            with open(filename, 'r') as f:
                config_data = json.load(f)
                client_config.update(config_data)
                print(f"Loaded configuration from {filename}")
        except FileNotFoundError:
            print(f"Error: Configuration file '{filename}' not found.", file=sys.stderr)
            sys.exit(1)
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON in configuration file '{filename}'.", file=sys.stderr)
            sys.exit(1)

    def list_nodes(self, args):
        print("Nodes")
        print("============================")
        nodes = HyperCycleClient.list_nodes(
            network=getattr(args, "network", None),
            aim_name=getattr(args, "aim_name", None),
            aim_version=getattr(args, "aim_version", None),
            aim_uri=getattr(args, "aim_uri", None),
            status=getattr(args, "status", "alive"),
            limit=getattr(args, "limit", None),
            order=getattr(args, "order", "desc"),
            order_by=getattr(args, "order_by", "last_updated"),
            node_version=getattr(args, "node_version", None),
        )
        if nodes:
            for node in nodes:
                print(f"- {node}")
        else:
            print("No nodes found or unable to connect to seed hosts.")

    def node_info(self, args):
        print(f"Node Info for {args.node}")
        print("============================")
        res = HyperCycleClient.node_info(args.node)
        if res:
            pprint.pprint(res)
        else:
            print(f"Could not retrieve information for node {args.node}.")

    def connect(self, args):
        print(f"Connecting to node {args.node} with amount {args.amount} {args.currency}...")
        txid = HyperCycleClient.connect_to_node(args.node, args.pk, args.amount, args.currency, args.driver)
        if txid:
            print(f"Connection initiated. Transaction ID: {txid}")
        else:
            print("Failed to connect to node.")

    def get_balance(self, args):
        print(f"Getting balance from node {args.node}...")
        if not args.address and not args.pk:
            print("Error: Either --config or --address or --pk must be provided.", file=sys.stderr)
            return
        balance_address = args.address
        if args.pk:
            try:
                w3 = Web3(Web3.HTTPProvider(client_config.get("rpc_provider")))
                balance_address = w3.eth.account.from_key(args.pk).address
                print(f"Using address derived from private key: {balance_address}")
            except Exception as e:
                print(f"Error deriving address from private key: {e}", file=sys.stderr)
                return

        if balance_address:
            res = HyperCycleClient.get_balance(args.node, address=balance_address, driver=args.driver)
            if res:
                print(f"Balance for {balance_address}:")
                pprint.pprint(res)
            else:
                print(f"Could not retrieve balance for {balance_address} from node {args.node}.")
        else:
            print("No valid address to query balance for.", file=sys.stderr)


    def get_manifest(self, args):
        print(f"Getting manifest for AIM slot {args.aim_slot} from node {args.node}...")
        res = HyperCycleClient.get_manifest(args.node, args.aim_slot)
        if res:
            try:
                pprint.pprint(json.loads(res))
            except json.JSONDecodeError:
                print(res) # Print as plain text if not valid JSON
        else:
            print(f"Could not retrieve manifest for AIM slot {args.aim_slot} from node {args.node}.")

    def get_aims(self, args):
        print("Available AIMs")
        print("============================")
        res = HyperCycleClient.get_available_aims(network=getattr(args, "network", None))
        if res:
            pprint.pprint(res)
        else:
            print("Could not retrieve AIMs or no seed hosts available.")

    def call_aim(self, args):
        print(f"Calling AIM slot {args.aim_slot} on node {args.node} with method {args.method} and URI {args.uri}...")
        res = HyperCycleClient.call(
            args.node,
            args.pk,
            args.aim_slot,
            args.method,
            args.uri,
            args.headers,
            body=args.body,
            protocol_version=args.protocol_version,
            driver=args.driver,
            cost_only=args.cost_only,
            is_public=args.is_public
        )
        if res is not None:
            print("\nAIM Call Response:")
            try:
                pprint.pprint(json.loads(res))
            except json.JSONDecodeError:
                print(res) # Print as plain text if not valid JSON
        else:
            print("AIM call failed.")


def main():
    cli = ClientCLI()
    cli.start()

if __name__ == '__main__':
    main()


