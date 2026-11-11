#pragma once
#include <chrono>
#include <vector>

#include "types.hpp"

struct AlgoResult {
    std::vector<int> route;   // empieza en 0, sin repetir el regreso
    long long operations = 0;
    bool timed_out = false;
};

struct Deadline {
    bool enabled = false;
    std::chrono::steady_clock::time_point limit;
    bool expired() const {
        return enabled && std::chrono::steady_clock::now() > limit;
    }
};

// Interfaz común de todos los algoritmos (patrón Strategy).
using AlgorithmFn = AlgoResult (*)(const Matrix&, const Deadline&);

AlgoResult nearest_neighbor(const Matrix& d, const Deadline& deadline);

