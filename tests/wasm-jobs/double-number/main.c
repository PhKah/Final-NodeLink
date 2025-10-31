#include <stdio.h>
#include <stdlib.h>
#include <sys/stat.h>

int main() {
    FILE *inputFile, *outputFile;
    int number, result;

    // Open the input file
    inputFile = fopen("/input.txt", "r");
    if (inputFile == NULL) {
        printf("Error: Cannot open input.txt\n");
        return 1;
    }

    // Read the number from the input file
    if (fscanf(inputFile, "%d", &number) != 1) {
        printf("Error: Failed to read number from input.txt\n");
        fclose(inputFile);
        return 1;
    }
    fclose(inputFile);

    // Calculate the result
    result = number * 2;

    // Create the output directory
    // The WASI environment might not allow mkdir, but we try.
    // It's safer to assume the runner creates the output path if specified.
    mkdir("/output", 0777);

    // Open the output file
    outputFile = fopen("/output/result.txt", "w");
    if (outputFile == NULL) {
        printf("Error: Cannot open output/result.txt for writing\n");
        return 1;
    }

    // Write the result to the output file
    fprintf(outputFile, "%d", result);
    fclose(outputFile);

    printf("Successfully processed number: %d -> %d\n", number, result);

    return 0;
}
