#include "solve.hpp"

#include <chrono>
#include <map>
#include <string>

#include "algorithm.hpp"
#include "instance.hpp"
#include "metrics.hpp"
#include "route.hpp"

using json = nlohmann::json;

struct AlgorithmInfo {
    AlgorithmFn fn;
    int max_n;  // tamaño máximo (nodos totales) que acepta el algoritmo
};

static const std::map<std::string, AlgorithmInfo>& registry() {
    static const std::map<std::string, AlgorithmInfo> r = {
        {"nearest_neighbor", {nearest_neighbor, 5000}},
        {"mst_dfs", {mst_dfs, 5000}},
	{"held_karp", {held_karp, 20}},
        {"backtracking", {backtracking, 100}},
    };
    return r;
}

json handle_solve(const json& req) {
    const std::string name = req.at("algorithm").get<std::string>();
    const auto it = registry().find(name);
    if (it == registry().end()) {
        throw EngineError("UNKNOWN_ALGORITHM", "Algoritmo no soportado: " + name);
    }

    Instance inst = instance_from_json(req.at("instance"));
    prepare_matrix(inst);

    const int n = static_cast<int>(inst.nodes.size());
    if (n > it->second.max_n) {
        throw EngineError("INSTANCE_TOO_LARGE",
                          name + " acepta como máximo " + std::to_string(it->second.max_n) +
                              " nodos");
    }

    const json options = req.value("options", json::object());
    const long long limit_ms = options.value("time_limit_ms", 10000LL);
    if (limit_ms <= 0) {
        throw EngineError("INVALID_REQUEST", "time_limit_ms debe ser mayor que 0");
    }


    // Se mide solo la ejecución del algoritmo (sin JSON ni arranque del proceso).
    reset_peak_memory();
    const long baseline_kb = current_memory_kb();

    const auto t0 = std::chrono::steady_clock::now();
    Deadline deadline;
    deadline.enabled = true;
    deadline.limit = t0 + std::chrono::milliseconds(limit_ms);

    const AlgoResult r = it->second.fn(inst.matrix, deadline);
    const auto t1 = std::chrono::steady_clock::now();
    const long peak_kb = peak_memory_kb();
    const double time_ms = std::chrono::duration<double, std::milli>(t1 - t0).count();

    json resp;
    resp["algorithm"] = name;
    resp["instance_id"] = inst.id;
    resp["distance_source"] = inst.distance_source;
    resp["metrics"] = {{"time_ms", time_ms},
                       {"baseline_memory_kb", baseline_kb},
                       {"peak_memory_kb", peak_kb},
                       {"operations", r.operations}};
    resp["error"] = nullptr;

    if (r.timed_out) {
        resp["status"] = "timeout";
        resp["route"] = nullptr;
        resp["cost_m"] = nullptr;
        return resp;
    }

    std::string why;
    if (!validate_route(r.route, inst.nodes.size(), why)) {
        throw EngineError("INTERNAL_ERROR", "El algoritmo devolvió una ruta inválida: " + why);
    }

    resp["status"] = "ok";
    resp["route"] = r.route;
    resp["cost_m"] = route_cost(inst.matrix, r.route);
    return resp;
}


