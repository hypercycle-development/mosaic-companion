#!/bin/bash
# AI Chat Infrastructure Health Check Script
# Usage: ./ai-chat-health-check.sh [--json]

set -e

JSON_OUTPUT=false
if [[ "$1" == "--json" ]]; then
    JSON_OUTPUT=true
fi

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Results storage
declare -a RESULTS
declare -a STATUSES

log_info() {
    if [[ "$JSON_OUTPUT" == "false" ]]; then
        echo -e "${GREEN}[INFO]${NC} $1"
    fi
}

log_warn() {
    if [[ "$JSON_OUTPUT" == "false" ]]; then
        echo -e "${YELLOW}[WARN]${NC} $1"
    fi
}

log_error() {
    if [[ "$JSON_OUTPUT" == "false" ]]; then
        echo -e "${RED}[ERROR]${NC} $1"
    fi
}

check_local_ollama() {
    local test_name="Local Ollama API (/api/tags)"
    local status="FAIL"
    local details=""
    
    if response=$(curl -sS http://localhost:11434/api/tags 2>&1); then
        if echo "$response" | grep -q '"models"'; then
            local model_count=$(echo "$response" | grep -o '"name"' | wc -l)
            status="PASS"
            details="${model_count} models available"
            log_info "$test_name: OK - $details"
        else
            details="Unexpected response format"
            log_error "$test_name: $details"
        fi
    else
        details="Connection failed: $response"
        log_error "$test_name: $details"
    fi
    
    RESULTS+=("$test_name: $status - $details")
    STATUSES+=("$status")
}

check_local_ollama_chat() {
    local test_name="Local Ollama Chat (/api/chat)"
    local status="FAIL"
    local details=""
    
    if response=$(curl -sS -X POST http://localhost:11434/api/chat \
        -H "Content-Type: application/json" \
        -d '{"model":"qwen2.5:32b","messages":[{"role":"user","content":"ping"}],"stream":false}' \
        -w "\nHTTP_STATUS:%{http_code}" 2>&1); then
        
        http_code=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
        if [[ "$http_code" == "200" ]]; then
            if echo "$response" | grep -q '"content":"Pong!"'; then
                status="PASS"
                details="Chat endpoint responding correctly"
                log_info "$test_name: OK - $details"
            else
                details="Unexpected response content"
                log_warn "$test_name: $details"
            fi
        else
            details="HTTP $http_code"
            log_error "$test_name: $details"
        fi
    else
        details="Connection failed"
        log_error "$test_name: $details"
    fi
    
    RESULTS+=("$test_name: $status - $details")
    STATUSES+=("$status")
}

check_ollama_com() {
    local test_name="Ollama.com Connectivity"
    local status="FAIL"
    local details=""
    
    if response=$(curl -sS -o /dev/null -w "%{http_code}" https://ollama.com 2>&1); then
        if [[ "$response" == "200" ]] || [[ "$response" == "301" ]] || [[ "$response" == "302" ]]; then
            status="PASS"
            details="HTTP $response"
            log_info "$test_name: OK - $details"
        else
            details="HTTP $response"
            log_warn "$test_name: $details"
        fi
    else
        details="Connection failed"
        log_error "$test_name: $details"
    fi
    
    RESULTS+=("$test_name: $status - $details")
    STATUSES+=("$status")
}

check_ollama_api_endpoint() {
    local test_name="Ollama API Endpoint (api.ollama.com)"
    local status="FAIL"
    local details=""
    
    # The API may return 301 (redirect) or 401 (auth required), which means it's reachable
    http_code=$(curl -sS -o /dev/null -w "%{http_code}" \
        -X POST https://api.ollama.com/v1/chat/completions \
        -H "Content-Type: application/json" \
        -d '{"model":"kimi-k2.5:cloud","messages":[{"role":"user","content":"ping"}]}' 2>&1 || true)
    
    if [[ "$http_code" == "401" ]] || [[ "$http_code" == "200" ]]; then
        status="PASS"
        details="HTTP $http_code (reachable)"
        log_info "$test_name: OK - $details"
    elif [[ "$http_code" == "301" ]] || [[ "$http_code" == "302" ]]; then
        # 301/302 indicates the endpoint is reachable but redirecting (usually to auth)
        status="PASS"
        details="HTTP $http_code (reachable, redirects to auth)"
        log_info "$test_name: OK - $details"
    elif [[ "$http_code" == "000" ]]; then
        details="Connection failed"
        log_error "$test_name: $details"
    else
        details="HTTP $http_code"
        log_warn "$test_name: $details"
    fi
    
    RESULTS+=("$test_name: $status - $details")
    STATUSES+=("$status")
}

check_dns_resolution() {
    local test_name="DNS Resolution (ollama.com)"
    local status="FAIL"
    local details=""
    
    if ip=$(host ollama.com 2>&1 | grep "has address" | head -1 | awk '{print $4}'); then
        if [[ -n "$ip" ]]; then
            status="PASS"
            details="Resolved to $ip"
            log_info "$test_name: OK - $details"
        else
            details="No IP found"
            log_error "$test_name: $details"
        fi
    else
        details="DNS lookup failed"
        log_error "$test_name: $details"
    fi
    
    RESULTS+=("$test_name: $status - $details")
    STATUSES+=("$status")
}

check_skills_directory() {
    local test_name="Skills Directory"
    local status="FAIL"
    local details=""
    
    if [[ -d "/home/mauricio/.hermes/skills" ]]; then
        local skill_count=$(find /home/mauricio/.hermes/skills -name "SKILL.md" 2>/dev/null | wc -l)
        status="PASS"
        details="$skill_count skills available"
        log_info "$test_name: OK - $details"
    else
        details="Directory not found"
        log_error "$test_name: $details"
    fi
    
    RESULTS+=("$test_name: $status - $details")
    STATUSES+=("$status")
}

output_json() {
    local overall_status="healthy"
    for s in "${STATUSES[@]}"; do
        if [[ "$s" == "FAIL" ]]; then
            overall_status="unhealthy"
            break
        fi
    done
    
    echo "{"
    echo "  \"timestamp\": \"$(date -Iseconds)\","
    echo "  \"status\": \"$overall_status\","
    echo "  \"checks\": ["
    
    local first=true
    for result in "${RESULTS[@]}"; do
        local name=$(echo "$result" | cut -d: -f1)
        local st=$(echo "$result" | cut -d: -f2 | tr -d ' ')
        local det=$(echo "$result" | cut -d: -f3-)
        
        if [[ "$first" == "true" ]]; then
            first=false
        else
            echo ","
        fi
        
        printf '    {"name": "%s", "status": "%s", "details": "%s"}' "$name" "$st" "$det"
    done
    
    echo ""
    echo "  ]"
    echo "}"
}

# Main execution
if [[ "$JSON_OUTPUT" == "false" ]]; then
    echo "========================================"
    echo "AI Chat Infrastructure Health Check"
    echo "========================================"
    echo ""
fi

check_local_ollama
check_local_ollama_chat
check_ollama_com
check_ollama_api_endpoint
check_dns_resolution
check_skills_directory

if [[ "$JSON_OUTPUT" == "true" ]]; then
    output_json
else
    echo ""
    echo "========================================"
    
    # Count results
    pass_count=0
    fail_count=0
    for s in "${STATUSES[@]}"; do
        if [[ "$s" == "PASS" ]]; then
            ((pass_count++))
        else
            ((fail_count++))
        fi
    done
    
    echo "Results: $pass_count passed, $fail_count failed"
    
    if [[ $fail_count -eq 0 ]]; then
        echo -e "${GREEN}Overall Status: HEALTHY${NC}"
        exit 0
    else
        echo -e "${RED}Overall Status: UNHEALTHY${NC}"
        exit 1
    fi
fi
