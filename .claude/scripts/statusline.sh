#!/bin/bash

# Read JSON input from stdin
input=$(cat)

# Extract values from JSON
current_dir=$(echo "$input" | jq -r '.workspace.current_dir // "."')
dir_name=$(basename "$current_dir")

# Token information
total_input=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0')
total_output=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0')
context_size=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')

# Calculate context window percentage
usage=$(echo "$input" | jq '.context_window.current_usage')
if [ "$usage" != "null" ]; then
    current_tokens=$(echo "$usage" | jq '.input_tokens + .cache_creation_input_tokens + .cache_read_input_tokens')
    context_pct=$((current_tokens * 100 / context_size))
else
    context_pct=0
fi

# Session cost & duration
cost_usd=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
duration_ms=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')

# Lines changed
lines_added=$(echo "$input" | jq -r '.cost.total_lines_added // 0')

# ANSI colors - NEON CYBERPUNK
NEON_PINK='\033[1;35m'
NEON_CYAN='\033[1;36m'
NEON_GREEN='\033[1;32m'
NEON_YELLOW='\033[1;33m'
NEON_RED='\033[1;31m'
NEON_BLUE='\033[1;34m'
DIM='\033[2m'
RESET='\033[0m'

# Build status line
status=""

# Directory with cyber bracket
status+="${DIM}⟨${RESET}${NEON_CYAN}${dir_name}${RESET}${DIM}⟩${RESET} "

# Kawaii mood based on context usage
if [ $context_pct -gt 80 ]; then
    status+="${NEON_RED}(×_×)${RESET} "
elif [ $context_pct -gt 60 ]; then
    status+="${NEON_YELLOW}(⌐■_■)${RESET} "
else
    status+="${NEON_GREEN}(◕‿◕)${RESET} "
fi

# Tokens with neon arrows
if [ $total_input -gt 0 ] || [ $total_output -gt 0 ]; then
    input_k=$((total_input / 1000))
    output_k=$((total_output / 1000))
    status+="${NEON_BLUE}▼${input_k}k ${NEON_PINK}▲${output_k}k${RESET} "
fi

# Lines added - ALWAYS SHOW (eWallet override)
if [ "$lines_added" -gt 0 ]; then
    status+="${NEON_GREEN}+${lines_added}L${RESET} "
fi

# Session duration (convert ms to minutes:seconds)
if [ "$duration_ms" != "0" ] && [ "$duration_ms" != "null" ]; then
    duration_sec=$((duration_ms / 1000))
    mins=$((duration_sec / 60))
    secs=$((duration_sec % 60))
    status+="${DIM}⏱${mins}m${secs}s${RESET} "
fi

# Session cost
if [ "$cost_usd" != "0" ] && [ "$cost_usd" != "null" ]; then
    formatted_cost=$(printf "%.2f" "$cost_usd")
    status+="${NEON_YELLOW}¤\$${formatted_cost}${RESET}"
fi

# Output
printf "%b" "$status"
