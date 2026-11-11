#include <limits>

#include "algorithm.hpp"

// Heurística voraz: desde el nodo actual, ir al no visitado más cercano.
// Empates: gana el índice menor (así el resultado es determinista).
// Operaciones: comparaciones de distancias.
AlgoResult nearest_neighbor(const Matrix& d, const Deadline& deadline) {
    const size_t n = d.size();
    AlgoResult res;
    res.route.reserve(n);

    std::vector<char> visited(n, 0);
    int current = 0;
    visited[0] = 1;
    res.route.push_back(0);

    for (size_t step = 1; step < n; ++step) {
        if (deadline.expired()) {
            res.timed_out = true;
            return res;
        }
        int best = -1;
        double best_d = std::numeric_limits<double>::infinity();
        for (size_t j = 0; j < n; ++j) {
            if (visited[j]) continue;
            ++res.operations;
            if (d[current][j] < best_d) {
                best_d = d[current][j];
                best = static_cast<int>(j);
            }
        }
        visited[best] = 1;
        res.route.push_back(best);
        current = best;
    }
    return res;
}

