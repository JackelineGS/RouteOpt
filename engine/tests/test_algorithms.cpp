#include <algorithm>
#include <chrono>
#include <cmath>
#include <iostream>
#include <limits>
#include <numeric>
#include <string>
#include <vector>

#include "algorithm.hpp"
#include "instance.hpp"
#include "route.hpp"

static int g_checks = 0;
static int g_failures = 0;

#define CHECK(cond)                                                                   \
    do {                                                                              \
        ++g_checks;                                                                   \
        if (!(cond)) {                                                                \
            ++g_failures;                                                             \
            std::cerr << "FALLO " << __FILE__ << ":" << __LINE__ << "  " #cond "\n";  \
        }                                                                             \
    } while (0)

static Matrix make_matrix(int n, unsigned seed) {
    Instance inst = generate_instance(n, seed, -12.15, -11.95, -77.12, -76.95);
    prepare_matrix(inst);
    return inst.matrix;
}

// Óptimo por fuerza bruta: prueba las (n-1)! permutaciones con el nodo 0 fijo.
static double brute_force_optimum(const Matrix& d) {
    std::vector<int> perm(d.size());
    std::iota(perm.begin(), perm.end(), 0);
    double best = std::numeric_limits<double>::infinity();
    do {
        best = std::min(best, route_cost(d, perm));
    } while (std::next_permutation(perm.begin() + 1, perm.end()));
    return best;
}

static void test_validator() {
    std::string why;
    CHECK(validate_route({0, 2, 1}, 3, why));
    CHECK(!validate_route({0, 1, 1}, 3, why));  // repite un nodo
    CHECK(!validate_route({1, 0, 2}, 3, why));  // no empieza en 0
    CHECK(!validate_route({0, 1}, 3, why));     // faltan nodos
    CHECK(!validate_route({0, 1, 5}, 3, why));  // fuera de rango
}

static void test_handmade() {
    Deadline none;
    const Matrix d = {{0, 10, 15, 20}, {10, 0, 35, 25}, {15, 35, 0, 30}, {20, 25, 30, 0}};
    std::string why;

    const AlgoResult nn = nearest_neighbor(d, none);
    CHECK(nn.route == std::vector<int>({0, 1, 3, 2}));
    CHECK(std::fabs(route_cost(d, nn.route) - 80.0) < 1e-9);
    CHECK(nn.operations == 6);

    const AlgoResult mst = mst_dfs(d, none);
    CHECK(mst.route == std::vector<int>({0, 1, 2, 3}));
    CHECK(std::fabs(route_cost(d, mst.route) - 95.0) < 1e-9);
    CHECK(mst.operations == 6);

    const AlgoResult hk = held_karp(d, none);
    CHECK(validate_route(hk.route, 4, why));
    CHECK(std::fabs(route_cost(d, hk.route) - 80.0) < 1e-9);
    CHECK(hk.operations == 12);
}

static void test_against_bruteforce() {
    Deadline none;
    const double tol = 1e-6;
    for (int n = 4; n <= 9; ++n) {
        for (unsigned seed = 1; seed <= 20; ++seed) {
            const Matrix d = make_matrix(n, seed);
            const double opt = brute_force_optimum(d);

            const AlgoResult nn = nearest_neighbor(d, none);
            const AlgoResult mst = mst_dfs(d, none);
            const AlgoResult hk = held_karp(d, none);

            std::string why;
            const size_t un = static_cast<size_t>(n);
            CHECK(validate_route(nn.route, un, why));
            CHECK(validate_route(mst.route, un, why));
            CHECK(validate_route(hk.route, un, why));

            const double c_nn = route_cost(d, nn.route);
            const double c_mst = route_cost(d, mst.route);
            const double c_hk = route_cost(d, hk.route);

            CHECK(std::fabs(c_hk - opt) <= tol);  // Held-Karp es exacto
            CHECK(c_nn >= opt - tol);             // nadie supera al óptimo
            CHECK(c_mst >= opt - tol);
            CHECK(c_mst <= 2.0 * opt + tol);      // garantía de la 2-aproximación

            const long long m = n - 1;
            CHECK(hk.operations == m * (m - 1) * (1LL << (m - 2)));
            CHECK(mst.operations == static_cast<long long>(n) * (n - 1) / 2);
        }
    }
}

static void test_medium_instances() {
    Deadline none;
    for (unsigned seed = 1; seed <= 5; ++seed) {
        const Matrix d = make_matrix(12, seed);
        const AlgoResult nn = nearest_neighbor(d, none);
        const AlgoResult mst = mst_dfs(d, none);
        const AlgoResult hk = held_karp(d, none);
        std::string why;
        CHECK(validate_route(hk.route, 12, why));
        const double c_hk = route_cost(d, hk.route);
        CHECK(c_hk <= route_cost(d, nn.route) + 1e-6);
        CHECK(c_hk <= route_cost(d, mst.route) + 1e-6);
    }
}

static void test_timeout() {
    Deadline dl;
    dl.enabled = true;
    dl.limit = std::chrono::steady_clock::now() + std::chrono::milliseconds(1);
    const AlgoResult hk = held_karp(make_matrix(18, 1), dl);
    CHECK(hk.timed_out);
}

int main() {
    test_validator();
    test_handmade();
    test_against_bruteforce();
    test_medium_instances();
    test_timeout();
    std::cout << g_checks << " comprobaciones, " << g_failures << " fallos\n";
    return g_failures == 0 ? 0 : 1;
}

