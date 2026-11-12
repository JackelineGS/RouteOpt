#include <limits>
#include <vector>

#include "algorithm.hpp"

// Aproximación basada en el árbol de expansión mínima (Prim con matriz, O(n^2)).
// El recorrido en preorden del MST equivale a recorrer el árbol completo
// saltando los nodos ya visitados. Es una 2-aproximación solo si la matriz es
// simétrica y cumple la desigualdad triangular.
// Operaciones: aristas evaluadas durante Prim (resultado: n(n-1)/2).
AlgoResult mst_dfs(const Matrix& d, const Deadline& deadline) {
    const size_t n = d.size();
    const double INF = std::numeric_limits<double>::infinity();
    AlgoResult res;

    std::vector<double> key(n, INF);
    std::vector<int> parent(n, -1);
    std::vector<char> in_tree(n, 0);
    key[0] = 0.0;

    for (size_t it = 0; it < n; ++it) {
        if (deadline.expired()) {
            res.timed_out = true;
            return res;
        }
        // Se elige el nodo fuera del árbol con menor clave (empate: índice menor).
        int u = -1;
        double best = INF;
        for (size_t v = 0; v < n; ++v) {
            if (!in_tree[v] && (u == -1 || key[v] < best)) {
                best = key[v];
                u = static_cast<int>(v);
            }
        }
        in_tree[u] = 1;
        for (size_t v = 0; v < n; ++v) {
            if (in_tree[v]) continue;
            ++res.operations;
            if (d[u][v] < key[v]) {
                key[v] = d[u][v];
                parent[v] = u;
            }
        }
    }

    // Hijos de cada nodo, en orden creciente de índice (resultado determinista).
    std::vector<std::vector<int>> children(n);
    for (size_t v = 1; v < n; ++v) {
        if (parent[v] < 0) continue;  // no debería ocurrir con una matriz válida
        children[parent[v]].push_back(static_cast<int>(v));
    }

    // DFS en preorden, iterativo para no depender del tamaño de la pila.
    res.route.reserve(n);
    std::vector<int> stack;
    stack.push_back(0);
    while (!stack.empty()) {
        const int u = stack.back();
        stack.pop_back();
        res.route.push_back(u);
        for (auto it = children[u].rbegin(); it != children[u].rend(); ++it) {
            stack.push_back(*it);
        }
    }
    return res;
}
