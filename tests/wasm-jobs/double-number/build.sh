#!/bin/bash

# This script compiles a C file into a WebAssembly module (WASM)
# compliant with the WebAssembly System Interface (WASI).

# Exit immediately if a command exits with a non-zero status.
set -e

# Get the absolute directory where the script is located
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# --- CONFIGURATION ---
# Path to the WASI SDK, relative to this script's location.
WASI_SDK_PATH="${SCRIPT_DIR}/../../wasi-sdk-wasi-sdk-27"

# Define the source and output file names using absolute paths
SOURCE_C="${SCRIPT_DIR}/main.c"
OUTPUT_WASM="${SCRIPT_DIR}/main.wasm"

# Check if clang is installed
if ! command -v clang &> /dev/null
then
    echo "Error: clang is not installed. Please install it to continue."
    echo "On Debian/Ubuntu: sudo apt-get install clang"
    echo "On macOS (with Homebrew): brew install llvm"
    exit 1
fi

# Check if WASI_SDK_PATH is valid
if [ ! -d "$WASI_SDK_PATH" ]; then
    echo "Error: WASI SDK not found at ${WASI_SDK_PATH}"
    echo "Please install the WASI SDK and/or update the WASI_SDK_PATH in this script."
    exit 1
fi

# Compile the C code to WASM
echo "Compiling ${SOURCE_C} to ${OUTPUT_WASM}..."

clang \
    --target=wasm32-wasi \
    --sysroot="${WASI_SDK_PATH}/share/wasi-sysroot" \
    -O3 \
    -o "${OUTPUT_WASM}" \
    "${SOURCE_C}"

echo "Compilation successful!"
