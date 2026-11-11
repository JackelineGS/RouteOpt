#pragma once

// Lectura de memoria del proceso (Linux, vía /proc). En otros sistemas devuelven 0.
long current_memory_kb();   // memoria residente actual
long peak_memory_kb();      // pico de memoria residente desde el último reset
void reset_peak_memory();   // reinicia el pico (si el sistema lo permite)

