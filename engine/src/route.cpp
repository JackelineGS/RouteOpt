#include "route.hpp"

bool validate_route(const std::vector<int>& route, size_t n, std::string& why) {
    if (route.size() != n) {
        why = "la ruta no tiene n nodos";
        return false;
    }
    if (route.empty() || route[0] != 0) {
        why = "la ruta no empieza en el depósito (nodo 0)";
        return false;
    }
    std::vector<char> seen(n, 0);
    for (int v : route) {
        if (v < 0 || static_cast<size_t>(v) >= n) {
            why = "la ruta tiene un nodo fuera de rango";
            return false;
        }
        if (seen[v]) {
            why = "la ruta repite un nodo";
            return false;
        }
        seen[v] = 1;
    }
    return true;
}

double route_cost(const Matrix& d, const std::vector<int>& route) {
    double total = 0.0;
    for (size_t i = 0; i + 1 < route.size(); ++i) {
        total += d[route[i]][route[i + 1]];
    }
    total += d[route.back()][route.front()];
    return total;
}

