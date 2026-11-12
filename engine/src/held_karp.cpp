#include <cstdint>
#include <limits>
#include <vector>

#include "algorithm.hpp"

// Programación dinámica sobre subconjuntos. Tiempo O(n^2 * 2^n), memoria O(n * 2^n).
// Los clientes 1..n-1 se mapean a los bits 0..m-1 (m = n-1).
// dp[mask][j] = costo mínimo de salir del depósito, visitar exactamente los
// clientes de mask y terminar en el cliente j.
// Operaciones: transiciones evaluadas (resultado: m(m-1) * 2^(m-2)).
// El tamaño máximo lo controla solve.cpp (INSTANCE_TOO_LARGE).
AlgoResult held_karp(const Matrix& d, const Deadline& deadline) {
    const size_t n = d.size();
    const size_t m = n - 1;
    const size_t states = size_t(1) << m;
    const double INF = std::numeric_limits<double>::infinity();
    constexpr uint8_t NONE = 255;

    AlgoResult res;
    std::vector<double> dp(states * m, INF);
    std::vector<uint8_t> par(states * m, NONE);

    for (size_t j = 0; j < m; ++j) {
        dp[(size_t(1) << j) * m + j] = d[0][j + 1];
    }

    for (size_t mask = 1; mask < states; ++mask) {
        if (((mask - 1) & 1023u) == 0 && deadline.expired()) {
            res.timed_out = true;
            return res;
        }
        for (size_t j = 0; j < m; ++j) {
            if (!(mask & (size_t(1) << j))) continue;
            const double cur = dp[mask * m + j];
            for (size_t k = 0; k < m; ++k) {
                if (mask & (size_t(1) << k)) continue;
                ++res.operations;
                const size_t next = mask | (size_t(1) << k);
                const double cand = cur + d[j + 1][k + 1];
                if (cand < dp[next * m + k]) {
                    dp[next * m + k] = cand;
                    par[next * m + k] = static_cast<uint8_t>(j);
                }
            }
        }
    }

    // Mejor cierre: terminar en j y regresar al depósito (empate: índice menor).
    const size_t full = states - 1;
    double best = INF;
    size_t best_j = 0;
    for (size_t j = 0; j < m; ++j) {
        const double total = dp[full * m + j] + d[j + 1][0];
        if (total < best) {
            best = total;
            best_j = j;
        }
    }

    // Reconstrucción hacia atrás con la tabla de predecesores.
    std::vector<int> rev;
    size_t mask = full;
    size_t j = best_j;
    while (true) {
        rev.push_back(static_cast<int>(j) + 1);
        const uint8_t pj = par[mask * m + j];
        mask &= ~(size_t(1) << j);
        if (pj == NONE) break;
        j = pj;
    }
    res.route.reserve(n);
    res.route.push_back(0);
    for (auto it = rev.rbegin(); it != rev.rend(); ++it) {
        res.route.push_back(*it);
    }
    return res;
}


