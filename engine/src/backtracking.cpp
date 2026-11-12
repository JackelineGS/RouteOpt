#include <algorithm>
#include <limits>
#include <vector>

#include "algorithm.hpp"

namespace {

// Branch and bound sobre rutas parciales que parten del depósito (nodo 0).
//  - Cota inicial: la solución de Nearest Neighbor.
//  - Poda: costo parcial + suma de la arista de salida más barata de cada nodo
//    aún no visitado >= mejor costo conocido. Es una cota inferior válida porque
//    cada nodo pendiente debe salir por alguna arista y, como mínimo, cuesta la
//    más barata.
//  - Orden: los hijos se visitan del más cercano al más lejano. El costo parcial
//    crece en ese orden, así que al podar uno se podan todos los siguientes.
// Operaciones: nodos del árbol de búsqueda explorados.
struct Search {
    const Matrix& d;
    const Deadline& deadline;
    size_t n;
    std::vector<double> min_out;
    std::vector<char> visited;
    std::vector<int> path;
    std::vector<std::vector<int>> kids;  // un buffer por nivel de profundidad
    std::vector<int> best_route;
    double best_cost;
    long long ops = 0;
    bool timed_out = false;

    Search(const Matrix& dist, const Deadline& dl)
        : d(dist), deadline(dl), n(dist.size()), min_out(n, 0.0), visited(n, 0), kids(n) {}

    void dfs(int cur, double partial, double sum_min_unvisited) {
        ++ops;
        if ((ops & 4095) == 0 && deadline.expired()) {
            timed_out = true;
            return;
        }
        if (path.size() == n) {
            const double total = partial + d[cur][0];
            if (total < best_cost) {
                best_cost = total;
                best_route = path;
            }
            return;
        }

        std::vector<int>& list = kids[path.size()];
        list.clear();
        for (size_t v = 1; v < n; ++v) {
            if (!visited[v]) list.push_back(static_cast<int>(v));
        }
        std::sort(list.begin(), list.end(), [&](int a, int b) {
            if (d[cur][a] != d[cur][b]) return d[cur][a] < d[cur][b];
            return a < b;
        });

        for (int c : list) {
            const double next_partial = partial + d[cur][c];
            if (next_partial + sum_min_unvisited >= best_cost - 1e-9) break;  // poda
            visited[c] = 1;
            path.push_back(c);
            dfs(c, next_partial, sum_min_unvisited - min_out[c]);
            path.pop_back();
            visited[c] = 0;
            if (timed_out) return;
        }
    }
};

}  // namespace

AlgoResult backtracking(const Matrix& d, const Deadline& deadline) {
    AlgoResult res;
    const size_t n = d.size();

    // Cota inicial: Nearest Neighbor.
    const AlgoResult nn = nearest_neighbor(d, deadline);
    if (nn.timed_out) {
        res.timed_out = true;
        return res;
    }

    Search s(d, deadline);
    s.best_route = nn.route;
    s.best_cost = 0.0;
    for (size_t i = 0; i < n; ++i) {
        s.best_cost += d[nn.route[i]][nn.route[(i + 1) % n]];
    }

    double sum_min = 0.0;
    for (size_t v = 0; v < n; ++v) {
        double m = std::numeric_limits<double>::infinity();
        for (size_t u = 0; u < n; ++u) {
            if (u != v && d[v][u] < m) m = d[v][u];
        }
        s.min_out[v] = m;
        if (v != 0) sum_min += m;
    }

    s.visited[0] = 1;
    s.path.push_back(0);
    s.dfs(0, 0.0, sum_min);

    res.operations = s.ops;
    if (s.timed_out) {
        res.timed_out = true;
        return res;
    }
    res.route = s.best_route;
    return res;
}


